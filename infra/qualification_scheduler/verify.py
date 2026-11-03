"""Read-only evidence collector: count distinct native ticks, not HTTP calls or manual tests."""
import argparse
import datetime as dt
import json

FUNCTION = 'brokiva-qualification-scheduler'


def summarize(records, since, required=12):
    cycles = {}
    failures = []
    for record in records:
        if record.get('source') != 'AWS_EVENTBRIDGE_SCHEDULER':
            continue
        try:
            when = dt.datetime.fromisoformat(record['scheduledTime'].replace('Z', '+00:00'))
        except (KeyError, TypeError, ValueError):
            continue
        if when < since:
            continue
        if record.get('event') == 'qualification_cycle_failed':
            failures.append(record)
        if record.get('event') == 'qualification_cycle_completed' and record.get('success') is True:
            cycles[record['scheduledTime']] = record
    ordered = sorted(cycles.values(), key=lambda r: r['scheduledTime'])
    gaps = []
    for a, b in zip(ordered, ordered[1:]):
        gap = (dt.datetime.fromisoformat(b['scheduledTime'].replace('Z', '+00:00')) -
               dt.datetime.fromisoformat(a['scheduledTime'].replace('Z', '+00:00'))).total_seconds()
        if abs(gap - 300) > 1:
            gaps.append({'from': a['scheduledTime'], 'to': b['scheduledTime'], 'seconds': gap})
    late = [r['scheduledTime'] for r in ordered if r.get('lagSeconds') is None or r['lagSeconds'] > 90]
    return {'validated': len(ordered) >= required and not gaps and not failures and not late,
            'successfulScheduledCycles': len(ordered), 'requiredCycles': required,
            'gaps': gaps, 'failedCycles': len(failures), 'lateCycles': late,
            'receipts': [{key: r.get(key) for key in ['scheduledTime', 'requestId', 'executionId', 'lagSeconds', 'confirmedRequests', 'hasPending']} for r in ordered]}


def main():
    import boto3
    parser = argparse.ArgumentParser()
    parser.add_argument('--since', required=True, help='UTC activation time, ISO-8601')
    parser.add_argument('--required', type=int, default=12)
    args = parser.parse_args()
    since = dt.datetime.fromisoformat(args.since.replace('Z', '+00:00'))
    logs = boto3.client('logs', region_name='us-east-1')
    records = []
    paginator = logs.get_paginator('filter_log_events')
    for page in paginator.paginate(logGroupName='/aws/lambda/' + FUNCTION, startTime=int(since.timestamp() * 1000),
            filterPattern='{ $.source = "AWS_EVENTBRIDGE_SCHEDULER" }'):
        for event in page['events']:
            try:
                records.append(json.loads(event['message']))
            except (ValueError, TypeError):
                continue
    report = summarize(records, since, args.required)
    cw = boto3.client('cloudwatch', region_name='us-east-1')
    report['alarms'] = [{'name': a['AlarmName'], 'state': a['StateValue']} for a in cw.describe_alarms(
        AlarmNamePrefix=FUNCTION + '-')['MetricAlarms']]
    report['validated'] = report['validated'] and len(report['alarms']) == 4 and all(a['state'] == 'OK' for a in report['alarms'])
    print(json.dumps(report))
    return 0 if report['validated'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
