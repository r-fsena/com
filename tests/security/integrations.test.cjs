const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness.cjs');

test('S3 gera assinatura real vinculada a tenant, tamanho e tipo do arquivo', async () => {
  const sdk = require('@aws-sdk/client-s3');
  class S3Client extends sdk.S3Client { constructor(options) { super({ ...options, credentials: { accessKeyId: 'isolated-test-key', secretAccessKey: 'isolated-test-secret' } }); } }
  const h = harness({ '@aws-sdk/client-s3': { ...sdk, S3Client } }, { AWS_S3_BUCKET_NAME: 'isolated-test-bucket', AWS_S3_REGION: 'sa-east-1' });
  const client = new (h.load('src/lib/s3-client.ts').S3StorageClient)();
  const result = await client.generatePresignedUploadUrl({ tenantId: 'tenant-a', fileName: 'contract.pdf', fileType: 'application/pdf', fileSizeBytes: 100 });
  const url = new URL(result.uploadUrl);
  assert.ok(url.searchParams.get('X-Amz-Signature')); assert.ok(url.pathname.startsWith('/tenants/tenant-a/attachments/'));
  assert.ok(url.searchParams.get('X-Amz-SignedHeaders').includes('content-type'));
  assert.ok(url.searchParams.get('X-Amz-SignedHeaders').includes('content-length'));
  await assert.rejects(client.generatePresignedUploadUrl({ tenantId: '../tenant-b', fileName: 'x.pdf', fileType: 'application/pdf', fileSizeBytes: 100 }));
});
test('Bedrock chama Converse e valida resposta, sem gerar resultado fictício', async () => {
  const calls = [];
  const analysis = { conversationType: 'REAL_ESTATE_LEAD', summary: 'Synthetic', extractedData: { detectedObjections: [] }, detectedObjections: [], responseOptions: [], sentiment: 'NEUTRAL', intent: 'DUVIDA_GERAL', suggestedResponse: 'Synthetic', confidenceScore: 0.8 };
  const h = harness({ '@aws-sdk/client-bedrock-runtime': {
    ConverseCommand: class { constructor(input) { this.input = input; } },
    BedrockRuntimeClient: class { async send(command) { calls.push(command.input); return { output: { message: { content: [{ text: JSON.stringify(analysis) }] } } }; } },
  } }, { AWS_BEDROCK_MODEL_ID: 'test-model' });
  const client = new (h.load('src/lib/bedrock-client.ts').BedrockCopilotClient)();
  assert.equal((await client.analyzeConversation([{ sender: 'CLIENT', text: 'Synthetic' }])).summary, 'Synthetic');
  assert.equal((await client.analyzeConversation([{ sender: 'CLIENT', text: 'Synthetic' }])).conversationType, 'REAL_ESTATE_LEAD');
  assert.equal(calls[0].modelId, 'test-model'); assert.equal(calls[0].messages[0].role, 'user');
});
test('Asaas usa cliente/cobrança/QR Code retornados pelo provedor', async () => {
  const calls = [];
  const responses = [ { data: [{ id: 'cus_real' }] }, { data: [] }, { id: 'pay_real', status: 'PENDING' }, { encodedImage: 'real-image', payload: 'provider-pix-payload' } ];
  const h = harness({ fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => responses.shift() }; } });
  const client = new (h.load('src/lib/asaas-client.ts').AsaasClient)('isolated-key', 'sandbox');
  const result = await client.createPayment({ customerName: 'Synthetic', customerCpfCnpj: '12345678901', value: 100, dueDate: '2030-01-01', billingType: 'PIX', externalReference: 'tenant-a:test-reference' });
  assert.equal(result.id, 'pay_real'); assert.equal(result.pixPayload, 'provider-pix-payload');
  assert.equal(calls[2].url, 'https://api-sandbox.asaas.com/v3/payments');
  assert.equal(JSON.parse(calls[2].options.body).customer, 'cus_real');
  assert.equal(calls[3].url, 'https://api-sandbox.asaas.com/v3/payments/pay_real/pixQrCode');
});
test('credenciais Z-API não migram entre tenants nem aceitam tokens arbitrários', async () => {
  const h = harness({}, { ZAPI_TENANT_ID: 'tenant-a', ZAPI_INSTANCE_ID: 'instance-a', ZAPI_INSTANCE_TOKEN: 'server-token', ZAPI_CLIENT_TOKEN: 'server-client-token' });
  const service = h.load('src/lib/db/zapi-credentials-service.ts').ZapiCredentialsService;
  await assert.rejects(service.resolveCredentials({ tenantId: 'tenant-b', instanceId: 'instance-a', token: 'browser-token' }));
  await assert.rejects(service.resolveCredentials({ tenantId: 'tenant-a', instanceId: 'instance-b' }));
  const credentials = await service.resolveCredentials({ tenantId: 'tenant-a', instanceId: 'instance-a', token: 'browser-token', clientToken: 'browser-client' });
  assert.equal(credentials.instanceToken, 'server-token'); assert.equal(credentials.securityToken, 'server-client-token');
});
