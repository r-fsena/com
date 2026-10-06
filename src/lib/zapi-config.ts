export interface ZapiInstanceCredentials {
  instanceId: string;
  token?: string;
  clientToken?: string;
  name?: string;
  tenantId?: string;
  assignedUserId?: string;
}

export const KNOWN_ZAPI_INSTANCES: Record<string, ZapiInstanceCredentials> = {
  // Instância Individual - Rafael Sena (Master)
  '3F1B67FC8139425171C79ED390C0144C': {
    instanceId: '3F1B67FC8139425171C79ED390C0144C',
    name: 'WhatsApp Individual • Rafael Sena',
    tenantId: 'tenant-1790857269847',
    assignedUserId: 'user-rafael-admin',
  },
  // Central WhatsApp - Amábile Barbarotti
  '3F8144490C66805B4E3FD64A35E2F2DC': {
    instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
    name: 'Central WhatsApp • Amábile Barbarotti',
    tenantId: 'tenant-amabile-barbarotti',
  },
};

export const DEFAULT_ZAPI_INSTANCE_ID = '3F1B67FC8139425171C79ED390C0144C';
export const DEFAULT_ZAPI_INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN || '';
export const DEFAULT_ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || '';

export function resolveZapiCredentials(
  rawInstanceId?: string | null,
  rawToken?: string | null,
  rawClientToken?: string | null
) {
  let instanceId = (rawInstanceId && rawInstanceId.trim() && rawInstanceId !== 'undefined' && rawInstanceId !== 'null')
    ? rawInstanceId.trim()
    : (process.env.ZAPI_INSTANCE_ID || DEFAULT_ZAPI_INSTANCE_ID);

  const known = KNOWN_ZAPI_INSTANCES[instanceId];

  let token = (rawToken && rawToken.trim() && rawToken !== 'undefined' && rawToken !== 'null')
    ? rawToken.trim()
    : (known?.token || process.env.ZAPI_INSTANCE_TOKEN || DEFAULT_ZAPI_INSTANCE_TOKEN);

  // Se a instância conhecida possui token configurado diretamente, priorize-o
  if (known && known.token) {
    token = known.token;
  }

  const clientToken = (rawClientToken && rawClientToken.trim() && rawClientToken !== 'undefined' && rawClientToken !== 'null')
    ? rawClientToken.trim()
    : (known?.clientToken || process.env.ZAPI_CLIENT_TOKEN || process.env.ZAPI_WEBHOOK_SECRET || DEFAULT_ZAPI_CLIENT_TOKEN);

  return {
    instanceId,
    instanceToken: token,
    securityToken: clientToken,
  };
}
