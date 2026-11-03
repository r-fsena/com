"""Dedicated qualification invoker. No database, messaging or external AI permissions."""
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.request

ORIGIN = 'https://crm.faithhubs.com'
PATH = '/api/internal/qualification/run'
NAMESPACE = 'Brokiva/QualificationScheduler'
SCHEDULE_SOURCE = 'AWS_EVENTBRIDGE_SCHEDULER'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _log(event, **fields):
    print(json.dumps({'event': event, **fields}, separators=(',', ':')))


def _metric(client, name, function_name, value=1):
    client.put_metric_data(Namespace=NAMESPACE, MetricData=[{
        'MetricName': name, 'Dimensions': [{'Name': 'FunctionName', 'Value': function_name}],
        'Unit': 'Count', 'Value': value,
    }])


def _scheduled_lag(event, now):
    try:
        scheduled = dt.datetime.fromisoformat(event['scheduledTime'].replace('Z', '+00:00')).timestamp()
        return max(0, round(now - scheduled, 3))
    except (KeyError, TypeError, ValueError):
        return None


def run_cycle(event, context, ssm, cloudwatch, opener=None, monotonic=time.monotonic, wall_clock=time.time):
    """Injected dependencies let failure/retry behavior be tested without production calls."""
    event = event or {}
    scheduled = event.get('source') == SCHEDULE_SOURCE
    function_name = context.function_name
    request_id = context.aws_request_id
    started = wall_clock()
    deadline = monotonic() + min(120, max(0, context.get_remaining_time_in_millis() / 1000 - 10))
    confirmed = 0
    has_pending = False
    try:
        origin = os.environ.get('CRM_ORIGIN', ORIGIN)
        if origin != ORIGIN:
            raise RuntimeError('Unapproved CRM origin')
        parameter_name = os.environ.get('SECRET_PARAMETER', '')
        if not parameter_name.startswith('/brokiva/qualification/'):
            raise RuntimeError('Invalid qualification secret reference')
        # The plaintext remains only in this invocation's memory; never log responses or headers.
        secret = ssm.get_parameter(Name=parameter_name, WithDecryption=True)['Parameter']['Value']
        if not isinstance(secret, str) or len(secret) < 32 or '\n' in secret or '\r' in secret:
            raise RuntimeError('Invalid qualification secret')
        transport = opener or urllib.request.build_opener(NoRedirect())
        for _ in range(4):
            remaining = deadline - monotonic()
            if remaining < 28:
                if not confirmed:
                    raise RuntimeError('Insufficient invocation time')
                break
            request = urllib.request.Request(origin + PATH, method='POST', headers={
                'Authorization': 'Bearer ' + secret,
                'Content-Type': 'application/json',
                'X-CRM-Scheduler': 'aws-eventbridge',
                'X-CRM-Scheduler-Invocation': request_id,
            }, data=b'{}')
            with transport.open(request, timeout=26) as response:
                if response.status != 200:
                    raise RuntimeError('CRM did not acknowledge qualification')
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise RuntimeError('Unexpected CRM acknowledgement size')
                body = json.loads(raw)
            if body.get('success') is not True or type(body.get('failed')) is not int or body['failed'] != 0:
                raise RuntimeError('CRM reported qualification failure')
            if type(body.get('completed')) is not int or body['completed'] < 0 or type(body.get('hasPending')) is not bool:
                raise RuntimeError('Invalid CRM acknowledgement')
            confirmed += 1
            has_pending = body['hasPending']
            if not has_pending:
                break
        _metric(cloudwatch, 'ScheduledCycleSuccess' if scheduled else 'ManualValidationSuccess', function_name)
        _metric(cloudwatch, 'ConfirmedRequests', function_name, confirmed)
        _metric(cloudwatch, 'PendingBacklog', function_name, int(has_pending))
        result = {'success': True, 'confirmedRequests': confirmed, 'hasPending': has_pending}
        _log('qualification_cycle_completed', **result, requestId=request_id,
             source=event.get('source', 'MANUAL_VALIDATION'),
             scheduledTime=event.get('scheduledTime'), executionId=event.get('executionId'),
             lagSeconds=_scheduled_lag(event, started), elapsedSeconds=round(wall_clock() - started, 3))
        return result
    except Exception as error:
        # No exception text: provider errors or response bodies may contain credentials/customer data.
        try:
            _metric(cloudwatch, 'ScheduledCycleFailure' if scheduled else 'ManualValidationFailure', function_name)
        except Exception:
            pass
        _log('qualification_cycle_failed', requestId=request_id, source=event.get('source', 'MANUAL_VALIDATION'),
             scheduledTime=event.get('scheduledTime'), executionId=event.get('executionId'),
             errorType=type(error).__name__, confirmedRequests=confirmed)
        raise RuntimeError('Qualification invocation failed; inspect sanitized operational logs') from None


def handler(event, context):
    import boto3
    return run_cycle(event, context, boto3.client('ssm'), boto3.client('cloudwatch'))
