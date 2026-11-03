import contextlib
import datetime as dt
import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from template import build_template
from verify import summarize
from worker import NAMESPACE, NoRedirect, ORIGIN, SCHEDULE_SOURCE, run_cycle

SECRET = 'synthetic-qualification-secret-over-thirty-two-characters'
PARAMETER = '/brokiva/qualification/cron-secret'


class Context:
    function_name = 'brokiva-qualification-scheduler'
    aws_request_id = 'synthetic-request'

    def get_remaining_time_in_millis(self):
        return 150000


class Metrics:
    def __init__(self):
        self.rows = []

    def put_metric_data(self, **value):
        self.rows.extend(value['MetricData'])
        assert value['Namespace'] == NAMESPACE


class SecretStore:
    def get_parameter(self, **value):
        assert value == {'Name': PARAMETER, 'WithDecryption': True}
        return {'Parameter': {'Value': SECRET}}


class Response:
    status = 200

    def __init__(self, value):
        self.body = json.dumps(value).encode() if not isinstance(value, bytes) else value

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self, limit):
        return self.body[:limit]


class Transport:
    def __init__(self, values):
        self.values = list(values)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        assert request.full_url == ORIGIN + '/api/internal/qualification/run'
        assert request.get_header('Authorization') == 'Bearer ' + SECRET
        assert timeout <= 26
        value = self.values.pop(0)
        if isinstance(value, Exception):
            raise value
        return Response(value)


def ack(pending=False):
    return {'success': True, 'failed': 0, 'completed': 3, 'hasPending': pending}


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SECRET_PARAMETER': PARAMETER, 'CRM_ORIGIN': ORIGIN})
        self.env.start()
        self.output = io.StringIO()
        self.capture = contextlib.redirect_stdout(self.output)
        self.capture.__enter__()

    def tearDown(self):
        self.capture.__exit__(None, None, None)
        self.env.stop()
        self.assertNotIn(SECRET, self.output.getvalue())

    def run_cycle(self, transport, scheduled=True, **kw):
        metrics = Metrics()
        result = run_cycle({'source': SCHEDULE_SOURCE if scheduled else 'MANUAL_VALIDATION',
                            'scheduledTime': '2026-11-02T12:00:00Z', 'executionId': 'synthetic-execution'},
                           Context(), SecretStore(), metrics, opener=transport, **kw)
        return result, metrics

    def test_acknowledged_native_cycle_and_sanitized_log(self):
        transport = Transport([ack()])
        result, metrics = self.run_cycle(transport)
        self.assertEqual(result, {'success': True, 'confirmedRequests': 1, 'hasPending': False})
        self.assertIn('ScheduledCycleSuccess', [row['MetricName'] for row in metrics.rows])
        log = json.loads(self.output.getvalue())
        self.assertEqual(log['executionId'], 'synthetic-execution')
        self.assertNotIn('Authorization', log)

    def test_manual_validation_never_fakes_periodic_heartbeat(self):
        _, metrics = self.run_cycle(Transport([ack()]), scheduled=False)
        self.assertNotIn('ScheduledCycleSuccess', [row['MetricName'] for row in metrics.rows])
        self.assertIn('ManualValidationSuccess', [row['MetricName'] for row in metrics.rows])

    def test_continue_backlog_only_after_confirmed_receipts(self):
        transport = Transport([ack(True), ack(True), ack(False)])
        result, _ = self.run_cycle(transport)
        self.assertEqual(result['confirmedRequests'], 3)
        self.assertEqual(len(transport.requests), 3)

    def test_limits_backlog_to_four_requests(self):
        transport = Transport([ack(True)] * 4)
        result, _ = self.run_cycle(transport)
        self.assertTrue(result['hasPending'])
        self.assertEqual(result['confirmedRequests'], 4)

    def test_http_error_is_retried_by_lambda_not_masked_as_success(self):
        metrics = Metrics()
        error = HTTPError(ORIGIN, 503, 'sensitive ' + SECRET, {}, io.BytesIO(b'private-response'))
        with self.assertRaisesRegex(RuntimeError, 'Qualification invocation failed'):
            run_cycle({'source': SCHEDULE_SOURCE}, Context(), SecretStore(), metrics, opener=Transport([error]))
        self.assertEqual([row['MetricName'] for row in metrics.rows], ['ScheduledCycleFailure'])
        self.assertNotIn('private-response', self.output.getvalue())

    def test_timeout_failure_then_next_invocation_resumes(self):
        with self.assertRaises(RuntimeError):
            self.run_cycle(Transport([TimeoutError(SECRET)]))
        result, _ = self.run_cycle(Transport([ack()]))
        self.assertTrue(result['success'])

    def test_reject_false_or_malformed_acknowledgement(self):
        for body in [{'success': False}, {'success': True, 'failed': 1}, {'success': True, 'failed': 0, 'completed': 0}, b'not-json', b'x' * 65537]:
            with self.subTest(body=type(body).__name__), self.assertRaises(RuntimeError):
                self.run_cycle(Transport([body]))

    def test_refuse_other_origins_and_redirects(self):
        with patch.dict(os.environ, {'CRM_ORIGIN': 'https://example.invalid'}), self.assertRaises(RuntimeError):
            self.run_cycle(Transport([]))
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.invalid'))

    def test_budget_never_starts_a_request_that_cannot_finish(self):
        clock = iter([0, 0, 100])
        result, _ = self.run_cycle(Transport([ack(True)]), monotonic=lambda: next(clock))
        self.assertEqual(result['confirmedRequests'], 1)
        self.assertTrue(result['hasPending'])


class InfrastructureTests(unittest.TestCase):
    def test_disabled_until_manual_validation_and_retries_are_configured(self):
        template = build_template()
        resources = template['Resources']
        self.assertEqual(template['Parameters']['ScheduleState']['Default'], 'DISABLED')
        schedule = resources['Schedule']['Properties']
        self.assertEqual(schedule['ScheduleExpression'], 'rate(5 minutes)')
        self.assertEqual(schedule['FlexibleTimeWindow'], {'Mode': 'OFF'})
        # This account has only the minimum unreserved quota: even a reservation of 1 is rejected.
        # Work exclusion remains enforced by the CRM's atomic per-conversation leases.
        self.assertNotIn('ReservedConcurrentExecutions', resources['Worker']['Properties'])
        self.assertEqual(resources['AsyncFailureHandling']['Properties']['MaximumRetryAttempts'], 2)
        self.assertEqual(resources['FailureQueue']['DeletionPolicy'], 'Retain')
        self.assertTrue(resources['FailureQueue']['Properties']['SqsManagedSseEnabled'])
        self.assertEqual(resources['HeartbeatAlarm']['Properties']['EvaluationPeriods'], 2)
        self.assertEqual(resources['HeartbeatAlarm']['Properties']['Period'], 300)

    def test_roles_are_limited_and_secret_is_not_in_template(self):
        template = build_template()
        worker = template['Resources']['WorkerRole']['Properties']['Policies'][0]['PolicyDocument']['Statement']
        self.assertEqual(worker[0]['Action'], 'ssm:GetParameter')
        self.assertIn('SecretParameterName', json.dumps(worker[0]['Resource']))
        self.assertEqual(worker[2]['Condition']['StringEquals']['cloudwatch:namespace'], NAMESPACE)
        rendered = json.dumps(template)
        for prohibited in ['bedrock:InvokeModel', 'ssm:GetParametersByPath', 'amplify:GetApp', SECRET, 'DATABASE_URL', 'GEMINI_API_KEY']:
            self.assertNotIn(prohibited, rendered)
        self.assertIn('ScheduleGroup', json.dumps(template['Resources']['SchedulerRole']['Properties']['AssumeRolePolicyDocument']))
        json.loads(template['Resources']['Dashboard']['Properties']['DashboardBody']['Fn::Sub'])


class DeploymentTests(unittest.TestCase):
    def test_configuring_notifications_preserves_active_timer_and_never_confirms_missing_recipient(self):
        from deploy import main
        from types import SimpleNamespace
        import sys
        recipient = 'operator@example.org'
        for subscription in [[], [{'Endpoint': 'different@example.org', 'SubscriptionArn': 'confirmed-arn'}],
                             [{'Endpoint': recipient, 'SubscriptionArn': 'PendingConfirmation'}],
                             [{'Endpoint': recipient, 'SubscriptionArn': 'confirmed-arn'}]]:
            cf = MagicMock()
            cf.exceptions = SimpleNamespace(ClientError=RuntimeError)
            original = {'ScheduleState': 'ENABLED', 'SecretParameterName': PARAMETER, 'AlertEmail': '****'}
            cf.describe_stacks.return_value = {'Stacks': [{'Parameters': [
                {'ParameterKey': key, 'ParameterValue': value} for key, value in original.items()],
                'Outputs': [{'OutputKey': 'AlertTopicArn', 'OutputValue': 'synthetic-topic'}]}]}
            sns = MagicMock()
            sns.list_subscriptions_by_topic.return_value = {'Subscriptions': subscription}
            output = io.StringIO()
            matches = bool(subscription) and subscription[0]['Endpoint'] == recipient
            with patch('deploy.clients', return_value={'cloudformation': cf, 'sns': sns}), \
                 patch.object(sys, 'argv', ['deploy.py', '--configure-alerts', '--alert-email', recipient]), \
                 contextlib.redirect_stdout(output):
                if matches:
                    main()
                else:
                    with self.assertRaises(RuntimeError):
                        main()
            # Resolve the proposed CloudFormation parameters as the service would.
            resolved = {p['ParameterKey']: original[p['ParameterKey']] if p.get('UsePreviousValue') else p['ParameterValue']
                        for p in cf.update_stack.call_args.kwargs['Parameters']}
            self.assertEqual(resolved['ScheduleState'], 'ENABLED')
            self.assertEqual(resolved['SecretParameterName'], PARAMETER)
            report = json.loads(output.getvalue())
            self.assertEqual(report['alertsConfigured'], matches)
            self.assertEqual(report['emailConfirmationRequired'], not (matches and subscription[0]['SubscriptionArn'] != 'PendingConfirmation'))
            self.assertNotIn(recipient, output.getvalue())


class EvidenceTests(unittest.TestCase):
    def receipts(self):
        start = dt.datetime(2026, 11, 2, 12, tzinfo=dt.timezone.utc)
        return start, [{'source': SCHEDULE_SOURCE, 'event': 'qualification_cycle_completed', 'success': True,
            'scheduledTime': (start + dt.timedelta(minutes=5 * i)).isoformat(), 'lagSeconds': 20} for i in range(12)]

    def test_requires_twelve_distinct_native_cycles(self):
        start, rows = self.receipts()
        self.assertTrue(summarize(rows, start)['validated'])
        self.assertFalse(summarize(rows[:1] * 12, start)['validated'])
        self.assertFalse(summarize([{**r, 'source': 'MANUAL_VALIDATION'} for r in rows], start)['validated'])

    def test_gap_delay_or_failed_attempt_prevents_cutover(self):
        start, rows = self.receipts()
        self.assertFalse(summarize(rows[:5] + rows[6:], start)['validated'])
        self.assertFalse(summarize([{**r, 'lagSeconds': 200} for r in rows], start)['validated'])
        self.assertFalse(summarize(rows + [{**rows[-1], 'event': 'qualification_cycle_failed'}], start)['validated'])


if __name__ == '__main__':
    unittest.main()
