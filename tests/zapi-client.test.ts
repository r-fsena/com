import { ZApiClient } from '../src/lib/zapi-client';

describe('Z-API Client & Webhook Validation Tests', () => {
  const zapi = new ZApiClient({
    instanceId: 'TEST-INSTANCE-01',
    instanceToken: 'TEST-TOKEN-XYZ',
    securityToken: 'SECURE-WEBHOOK-SECRET-123',
  });

  test('Verify valid webhook security token header', () => {
    const isValid = zapi.verifyWebhookSecurity('SECURE-WEBHOOK-SECRET-123');
    expect(isValid).toBe(true);
  });

  test('Reject invalid webhook security token header', () => {
    const isInvalid = zapi.verifyWebhookSecurity('WRONG-TOKEN');
    expect(isInvalid).toBe(false);
  });

  test('Reject missing webhook security token header', () => {
    const isMissing = zapi.verifyWebhookSecurity(null);
    expect(isMissing).toBe(false);
  });
});
