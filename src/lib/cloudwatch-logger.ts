import { 
  CloudWatchLogsClient, 
  PutLogEventsCommand, 
  CreateLogStreamCommand, 
  CreateLogGroupCommand 
} from '@aws-sdk/client-cloudwatch-logs';

export interface ExtensionLogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  event: string;
  tenantId?: string;
  brokerName?: string;
  contactName?: string;
  phone?: string;
  messagesCount?: number;
  details?: any;
}

// Buffer em memória para consulta rápida em tempo real (últimos 200 logs)
const GLOBAL_LOG_BUFFER: ExtensionLogEntry[] = [];

let cwClient: CloudWatchLogsClient | null = null;
let streamCreated = false;

function getClient() {
  if (cwClient) return cwClient;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (accessKeyId && secretAccessKey) {
    cwClient = new CloudWatchLogsClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return cwClient;
}

export async function recordExtensionLog(entry: ExtensionLogEntry) {
  // 1. Grava no buffer de consulta rápida
  GLOBAL_LOG_BUFFER.unshift(entry);
  if (GLOBAL_LOG_BUFFER.length > 200) {
    GLOBAL_LOG_BUFFER.pop();
  }

  // 2. Structured JSON Log no stdout (capturado nativamente pelo CloudWatch em qualquer infra AWS)
  const logString = JSON.stringify({
    source: 'brokiva-chrome-extension',
    ...entry,
    isoTime: new Date(entry.timestamp).toISOString(),
  });

  if (entry.level === 'ERROR') {
    console.error(`[CLOUDWATCH_LOG] ${logString}`);
  } else if (entry.level === 'WARN') {
    console.warn(`[CLOUDWATCH_LOG] ${logString}`);
  } else {
    console.log(`[CLOUDWATCH_LOG] ${logString}`);
  }

  // 3. Envio direto via AWS CloudWatch Logs SDK se credenciais explícitas existirem
  const client = getClient();
  if (!client) return;

  const logGroupName = process.env.CLOUDWATCH_LOG_GROUP || '/brokiva/extension-sync';
  const logStreamName = process.env.CLOUDWATCH_LOG_STREAM || `whatsapp-web-${new Date().toISOString().slice(0, 10)}`;

  try {
    if (!streamCreated) {
      try {
        await client.send(new CreateLogGroupCommand({ logGroupName }));
      } catch {}
      try {
        await client.send(new CreateLogStreamCommand({ logGroupName, logStreamName }));
      } catch {}
      streamCreated = true;
    }

    await client.send(new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [
        {
          message: logString,
          timestamp: entry.timestamp,
        },
      ],
    }));
  } catch (err: any) {
    console.warn('[CloudWatch SDK Warning]:', err.message);
  }
}

export function getExtensionLogs(limit = 50): ExtensionLogEntry[] {
  return GLOBAL_LOG_BUFFER.slice(0, limit);
}
