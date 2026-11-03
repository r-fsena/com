"""Render, plan or deploy only the dedicated qualification stack.

Run from AWS CloudShell or an already-authenticated AWS CLI environment.
Secrets are copied within the same AWS account, never written into the template/output.
"""
import argparse
import datetime as dt
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from template import build_template

STACK = 'brokiva-qualification-scheduler'
PARAMETER = '/brokiva/qualification/cron-secret'
ACCOUNT = '896884286429'
REGION = 'us-east-1'


def clients(region):
    import boto3
    session = boto3.Session(region_name=region)
    if session.client('sts').get_caller_identity()['Account'] != ACCOUNT:
        raise RuntimeError('Wrong AWS account; dedicated scheduler deployment stopped')
    return {service: session.client(service) for service in ['cloudformation', 'ssm', 'amplify', 'lambda', 'scheduler']}


def synchronize_secret(api):
    values = api['amplify'].get_app(appId='d2l9o2nsd8nhld')['app'].get('environmentVariables', {})
    secret = values.get('QUALIFICATION_CRON_SECRET') or values.get('AUTOMATIONS_CRON_SECRET')
    if not secret or len(secret) < 32:
        raise RuntimeError('The existing CRM qualification secret is not configured')
    try:
        existing = api['ssm'].get_parameter(Name=PARAMETER, WithDecryption=True)['Parameter']['Value']
    except api['ssm'].exceptions.ParameterNotFound:
        api['ssm'].put_parameter(Name=PARAMETER, Type='SecureString', Value=secret,
            Description='Existing CRM qualification callback secret; no outbound messaging.',
            Tags=[{'Key': 'Project', 'Value': 'Brokiva-Qualification'}])
        return 'created'
    if existing != secret:
        raise RuntimeError('Existing protected parameter differs; explicit rotation is required')
    return 'unchanged'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--render', type=Path)
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--execute-change-set')
    parser.add_argument('--activate', action='store_true')
    parser.add_argument('--status', action='store_true')
    parser.add_argument('--region', default=REGION, choices=[REGION])
    parser.add_argument('--alert-email', default='')
    args = parser.parse_args()
    template = build_template()
    body = json.dumps(template, separators=(',', ':'))
    if args.render:
        args.render.write_text(body)
        print(json.dumps({'rendered': str(args.render), 'sha256': hashlib.sha256(body.encode()).hexdigest(), 'resourceCount': len(template['Resources'])}))
    if not any([args.plan, args.apply, args.activate, args.status, args.execute_change_set]):
        return
    api = clients(args.region)
    cf = api['cloudformation']
    if args.status:
        stack = cf.describe_stacks(StackName=STACK)['Stacks'][0]
        outputs = {row['OutputKey']: row['OutputValue'] for row in stack.get('Outputs', [])}
        print(json.dumps({'stackStatus': stack['StackStatus'], 'outputs': outputs}))
        return
    if args.activate:
        result = api['lambda'].invoke(FunctionName=STACK, InvocationType='RequestResponse',
            Payload=json.dumps({'source': 'MANUAL_VALIDATION'}).encode())
        receipt = json.loads(result['Payload'].read())
        if result.get('FunctionError') or receipt.get('success') is not True:
            raise RuntimeError('Manual qualification validation did not succeed; schedule remains unchanged')
        stack = cf.describe_stacks(StackName=STACK)['Stacks'][0]
        if any(p['ParameterKey'] == 'ScheduleState' and p['ParameterValue'] == 'ENABLED' for p in stack['Parameters']):
            print(json.dumps({'manualValidation': 'success', 'scheduleState': 'ENABLED', 'alreadyActive': True}))
            return
        parameters = [{'ParameterKey': p['ParameterKey'], 'UsePreviousValue': True}
                      for p in stack['Parameters'] if p['ParameterKey'] != 'ScheduleState']
        parameters.append({'ParameterKey': 'ScheduleState', 'ParameterValue': 'ENABLED'})
        cf.update_stack(StackName=STACK, UsePreviousTemplate=True, Parameters=parameters, Capabilities=['CAPABILITY_IAM'])
        cf.get_waiter('stack_update_complete').wait(StackName=STACK, WaiterConfig={'Delay': 5, 'MaxAttempts': 120})
        print(json.dumps({'manualValidation': 'success', 'scheduleState': 'ENABLED', 'activationTime': dt.datetime.now(dt.timezone.utc).isoformat()}))
        return
    if args.execute_change_set:
        changes = cf.describe_change_set(StackName=STACK, ChangeSetName=args.execute_change_set)
        if changes['Status'] != 'CREATE_COMPLETE' or changes['ExecutionStatus'] != 'AVAILABLE':
            raise RuntimeError('The reviewed change set is not executable')
        stack = cf.describe_stacks(StackName=STACK)['Stacks'][0]
        creating = stack['StackStatus'] == 'REVIEW_IN_PROGRESS'
        synchronize_secret(api)
        cf.execute_change_set(StackName=STACK, ChangeSetName=args.execute_change_set)
        cf.get_waiter('stack_create_complete' if creating else 'stack_update_complete').wait(
            StackName=STACK, WaiterConfig={'Delay': 5, 'MaxAttempts': 180})
        print(json.dumps({'stack': STACK, 'deployment': 'complete', 'scheduleState': 'DISABLED'}))
        return
    try:
        stack = cf.describe_stacks(StackName=STACK)['Stacks'][0]
        change_type = 'CREATE' if stack['StackStatus'] == 'REVIEW_IN_PROGRESS' else 'UPDATE'
    except cf.exceptions.ClientError as error:
        if 'does not exist' not in error.response['Error']['Message']:
            raise
        change_type = 'CREATE'
    # Plan the stack with the regular schedule disabled until the authenticated callback is tested.
    parameters = [
        {'ParameterKey': 'SecretParameterName', 'ParameterValue': PARAMETER},
        {'ParameterKey': 'ScheduleState', 'ParameterValue': 'DISABLED'},
        {'ParameterKey': 'AlertEmail', 'ParameterValue': args.alert_email},
    ]
    name = 'qualification-' + str(int(time.time()))
    cf.create_change_set(StackName=STACK, ChangeSetName=name, ChangeSetType=change_type,
        TemplateBody=body, Parameters=parameters, Capabilities=['CAPABILITY_IAM'],
        Tags=[{'Key': 'Project', 'Value': 'Brokiva-Qualification'}, {'Key': 'ManagedBy', 'Value': 'CloudFormation'}])
    cf.get_waiter('change_set_create_complete').wait(StackName=STACK, ChangeSetName=name,
        WaiterConfig={'Delay': 3, 'MaxAttempts': 120})
    changes = cf.describe_change_set(StackName=STACK, ChangeSetName=name)
    print(json.dumps({'changeSet': name, 'type': change_type, 'changes': [
        {key: row['ResourceChange'].get(key) for key in ['Action', 'LogicalResourceId', 'ResourceType', 'Replacement']}
        for row in changes.get('Changes', [])]}))
    if not args.apply:
        return
    secret_state = synchronize_secret(api)
    cf.execute_change_set(StackName=STACK, ChangeSetName=name)
    cf.get_waiter('stack_create_complete' if change_type == 'CREATE' else 'stack_update_complete').wait(
        StackName=STACK, WaiterConfig={'Delay': 5, 'MaxAttempts': 180})
    print(json.dumps({'stack': STACK, 'deployment': 'complete', 'secretParameter': secret_state, 'scheduleState': 'DISABLED'}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # AWS SDK exception strings can echo API inputs; keep deployment output free of credentials.
        code = getattr(error, 'response', {}).get('Error', {}).get('Code', type(error).__name__)
        print(json.dumps({'success': False, 'errorCode': code, 'message': 'Deployment step not confirmed; inspect the stack events.'}), file=sys.stderr)
        sys.exit(1)
