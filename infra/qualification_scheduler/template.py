"""Render an isolated CloudFormation stack, with inline code and narrowly scoped roles."""
import json
from pathlib import Path


def sub(value):
    return {'Fn::Sub': value}


def ref(value):
    return {'Ref': value}


def arn(value):
    return {'Fn::GetAtt': [value, 'Arn']}


def build_template():
    function_name = 'brokiva-qualification-scheduler'
    group_name = 'brokiva-qualification'
    policy = lambda statements: {'Version': '2012-10-17', 'Statement': statements}
    resources = {
        'FailureQueue': {
            'Type': 'AWS::SQS::Queue',
            'Properties': {'QueueName': function_name + '-failures', 'MessageRetentionPeriod': 1209600,
                           'SqsManagedSseEnabled': True},
            'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain',
        },
        'AlertTopic': {'Type': 'AWS::SNS::Topic', 'Properties': {'TopicName': function_name + '-alerts'}},
        'AlertTopicPolicy': {'Type': 'AWS::SNS::TopicPolicy', 'Properties': {
            'Topics': [ref('AlertTopic')], 'PolicyDocument': policy([{
                'Effect': 'Allow', 'Principal': {'Service': 'cloudwatch.amazonaws.com'}, 'Action': 'sns:Publish',
                'Resource': ref('AlertTopic'), 'Condition': {'StringEquals': {'aws:SourceAccount': ref('AWS::AccountId')},
                    'ArnLike': {'aws:SourceArn': sub('arn:${AWS::Partition}:cloudwatch:${AWS::Region}:${AWS::AccountId}:alarm:' + function_name + '-*')}},
            }]),
        }},
        'AlertSubscription': {
            'Type': 'AWS::SNS::Subscription', 'Condition': 'HasAlertEmail',
            'Properties': {'TopicArn': ref('AlertTopic'), 'Protocol': 'email', 'Endpoint': ref('AlertEmail')},
        },
        'LogGroup': {'Type': 'AWS::Logs::LogGroup', 'Properties': {
            'LogGroupName': '/aws/lambda/' + function_name, 'RetentionInDays': 30},
            'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain'},
        'WorkerRole': {'Type': 'AWS::IAM::Role', 'Properties': {
            'AssumeRolePolicyDocument': policy([{'Effect': 'Allow', 'Principal': {'Service': 'lambda.amazonaws.com'}, 'Action': 'sts:AssumeRole'}]),
            'Policies': [{'PolicyName': 'QualificationOnly', 'PolicyDocument': policy([
                {'Effect': 'Allow', 'Action': 'ssm:GetParameter',
                 'Resource': sub('arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter${SecretParameterName}')},
                {'Effect': 'Allow', 'Action': ['logs:CreateLogStream', 'logs:PutLogEvents'], 'Resource': arn('LogGroup')},
                {'Effect': 'Allow', 'Action': 'cloudwatch:PutMetricData', 'Resource': '*',
                 'Condition': {'StringEquals': {'cloudwatch:namespace': 'Brokiva/QualificationScheduler'}}},
                {'Effect': 'Allow', 'Action': 'sqs:SendMessage', 'Resource': arn('FailureQueue')},
            ])}],
        }},
        'Worker': {'Type': 'AWS::Lambda::Function', 'DependsOn': ['LogGroup'], 'Properties': {
            'FunctionName': function_name, 'Description': 'Invokes only CRM qualification; no outbound messaging or AI credentials.',
            'Runtime': 'python3.12', 'Handler': 'index.handler', 'MemorySize': 128, 'Timeout': 150,
            'ReservedConcurrentExecutions': 1, 'Role': arn('WorkerRole'),
            'Environment': {'Variables': {'CRM_ORIGIN': 'https://crm.faithhubs.com', 'SECRET_PARAMETER': ref('SecretParameterName')}},
            'Code': {'ZipFile': Path(__file__).with_name('worker.py').read_text()},
        }},
        'AsyncFailureHandling': {'Type': 'AWS::Lambda::EventInvokeConfig', 'Properties': {
            'FunctionName': ref('Worker'), 'Qualifier': '$LATEST', 'MaximumEventAgeInSeconds': 900,
            'MaximumRetryAttempts': 2, 'DestinationConfig': {'OnFailure': {'Destination': arn('FailureQueue')}},
        }},
        'ScheduleGroup': {'Type': 'AWS::Scheduler::ScheduleGroup', 'Properties': {'Name': group_name}},
        'SchedulerRole': {'Type': 'AWS::IAM::Role', 'Properties': {
            'AssumeRolePolicyDocument': policy([{
                'Effect': 'Allow', 'Principal': {'Service': 'scheduler.amazonaws.com'}, 'Action': 'sts:AssumeRole',
                'Condition': {'StringEquals': {'aws:SourceAccount': ref('AWS::AccountId'), 'aws:SourceArn': arn('ScheduleGroup')}},
            }]),
            'Policies': [{'PolicyName': 'InvokeOnlyQualification', 'PolicyDocument': policy([
                {'Effect': 'Allow', 'Action': 'lambda:InvokeFunction', 'Resource': arn('Worker')},
                {'Effect': 'Allow', 'Action': 'sqs:SendMessage', 'Resource': arn('FailureQueue')},
            ])}],
        }},
        'Schedule': {'Type': 'AWS::Scheduler::Schedule', 'DependsOn': ['AsyncFailureHandling'], 'Properties': {
            'Name': function_name, 'GroupName': ref('ScheduleGroup'), 'State': ref('ScheduleState'),
            'Description': 'Dedicated five-minute qualification cadence; flexible window disabled.',
            'ScheduleExpression': 'rate(5 minutes)', 'ScheduleExpressionTimezone': 'UTC',
            'FlexibleTimeWindow': {'Mode': 'OFF'},
            'Target': {'Arn': arn('Worker'), 'RoleArn': arn('SchedulerRole'),
                       'DeadLetterConfig': {'Arn': arn('FailureQueue')},
                       'RetryPolicy': {'MaximumEventAgeInSeconds': 300, 'MaximumRetryAttempts': 2},
                       'Input': json.dumps({'source': 'AWS_EVENTBRIDGE_SCHEDULER',
                                            'scheduledTime': '<aws.scheduler.scheduled-time>',
                                            'executionId': '<aws.scheduler.execution-id>',
                                            'scheduleArn': '<aws.scheduler.schedule-arn>',
                                            'attemptNumber': '<aws.scheduler.attempt-number>'})},
        }},
    }
    def alarm(name, namespace, metric, dimensions, **properties):
        return {'Type': 'AWS::CloudWatch::Alarm', 'Properties': {
            'AlarmName': function_name + '-' + name, 'Namespace': namespace, 'MetricName': metric,
            'Dimensions': dimensions, 'Statistic': 'Sum', 'Period': 300,
            'EvaluationPeriods': 1, 'DatapointsToAlarm': 1, 'Threshold': 0,
            'ComparisonOperator': 'GreaterThanThreshold', 'TreatMissingData': 'notBreaching',
            'ActionsEnabled': {'Fn::If': ['IsEnabled', True, False]},
            'AlarmActions': [ref('AlertTopic')], **properties,
        }}
    dimensions = [{'Name': 'FunctionName', 'Value': ref('Worker')}]
    resources['HeartbeatAlarm'] = alarm('missing-heartbeat', 'Brokiva/QualificationScheduler', 'ScheduledCycleSuccess', dimensions,
        AlarmDescription='No successful scheduled cycle in two consecutive five-minute periods.',
        EvaluationPeriods=2, DatapointsToAlarm=2, Threshold=1, ComparisonOperator='LessThanThreshold', TreatMissingData='breaching')
    resources['WorkerFailureAlarm'] = alarm('worker-failure', 'AWS/Lambda', 'Errors', dimensions,
        AlarmDescription='The qualification worker failed; asynchronous retries and failure queue apply.')
    resources['DeliveryFailureAlarm'] = alarm('delivery-failure', 'AWS/Scheduler', 'InvocationDroppedCount',
        [{'Name': 'ScheduleGroup', 'Value': ref('ScheduleGroup')}], AlarmDescription='Scheduler discarded an invocation after retry/age policy.')
    resources['FailureQueueAlarm'] = alarm('failure-queue', 'AWS/SQS', 'ApproximateNumberOfMessagesVisible',
        [{'Name': 'QueueName', 'Value': {'Fn::GetAtt': ['FailureQueue', 'QueueName']}}],
        Statistic='Maximum', AlarmDescription='A failed event is retained in the qualification failure queue.')
    dashboard_body = {'widgets': [
        {'type': 'alarm', 'width': 24, 'height': 3, 'properties': {'title': 'Qualification operational alarms',
            'alarms': [sub('${HeartbeatAlarm.Arn}'), sub('${WorkerFailureAlarm.Arn}'), sub('${DeliveryFailureAlarm.Arn}'), sub('${FailureQueueAlarm.Arn}')] }},
        {'type': 'metric', 'width': 12, 'height': 6, 'properties': {'region': '${AWS::Region}', 'title': 'Successful scheduled cycles',
            'period': 300, 'stat': 'Sum', 'metrics': [['Brokiva/QualificationScheduler', 'ScheduledCycleSuccess', 'FunctionName', function_name]]}},
        {'type': 'log', 'width': 24, 'height': 8, 'properties': {'region': '${AWS::Region}', 'title': 'Sanitized cycle receipts',
            'query': "SOURCE '/aws/lambda/" + function_name + "' | fields @timestamp, event, scheduledTime, lagSeconds, confirmedRequests, hasPending | filter event = 'qualification_cycle_completed' | sort @timestamp desc | limit 30"}},
    ]}
    # DashboardBody is JSON with CloudFormation placeholders, resolved only by Fn::Sub.
    dashboard_json = json.dumps(dashboard_body)
    for resource in ['HeartbeatAlarm', 'WorkerFailureAlarm', 'DeliveryFailureAlarm', 'FailureQueueAlarm']:
        dashboard_json = dashboard_json.replace(json.dumps(sub('${' + resource + '.Arn}')), '"${' + resource + '.Arn}"')
    resources['Dashboard'] = {'Type': 'AWS::CloudWatch::Dashboard', 'Properties': {
        'DashboardName': function_name, 'DashboardBody': sub(dashboard_json)}}
    return {
        'AWSTemplateFormatVersion': '2010-09-09',
        'Description': 'Isolated Brokiva qualification scheduler. No changes to CRM database, extension, messaging or AI.',
        'Parameters': {
            'SecretParameterName': {'Type': 'String', 'Default': '/brokiva/qualification/cron-secret', 'AllowedPattern': '^/brokiva/qualification/[a-zA-Z0-9_/-]+$'},
            'ScheduleState': {'Type': 'String', 'Default': 'DISABLED', 'AllowedValues': ['DISABLED', 'ENABLED']},
            'AlertEmail': {'Type': 'String', 'Default': '', 'NoEcho': True, 'AllowedPattern': '^$|^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'},
        },
        'Conditions': {'HasAlertEmail': {'Fn::Not': [{'Fn::Equals': [ref('AlertEmail'), '']}]},
                       'IsEnabled': {'Fn::Equals': [ref('ScheduleState'), 'ENABLED']}},
        'Resources': resources,
        'Outputs': {
            'FunctionName': {'Value': ref('Worker')}, 'FunctionArn': {'Value': arn('Worker')},
            'ScheduleName': {'Value': ref('Schedule')}, 'ScheduleGroup': {'Value': ref('ScheduleGroup')},
            'FailureQueueUrl': {'Value': ref('FailureQueue')}, 'FailureQueueArn': {'Value': arn('FailureQueue')},
            'LogGroup': {'Value': ref('LogGroup')}, 'AlertTopicArn': {'Value': ref('AlertTopic')},
            'DashboardUrl': {'Value': sub('https://${AWS::Region}.console.aws.amazon.com/cloudwatch/home?region=${AWS::Region}#dashboards:name=' + function_name)},
        },
    }


if __name__ == '__main__':
    print(json.dumps(build_template(), indent=2))
