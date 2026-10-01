export interface ZapiInstanceCredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  name?: string;
  tenantId?: string;
  assignedUserId?: string;
}

export const KNOWN_ZAPI_INSTANCES: Record<string, ZapiInstanceCredentials> = {
  // Instância Individual - Rafael Sena (Master)
  '3F1B67FC8139425171C79ED390C0144C': {
    instanceId: '3F1B67FC8139425171C79ED390C0144C',
    token: '7A18BD2BADA4840FB0374499',
    clientToken: 'Fc78d61c833db4b50864816b70766aee8S',
    name: 'WhatsApp Individual • Rafael Sena',
    tenantId: 'tenant-1790857269847',
    assignedUserId: 'user-rafael-admin',
  },
  // Central WhatsApp - Amábile Barbarotti
  '3F8144490C66805B4E3FD64A35E2F2DC': {
    instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
    token: '550DBC07B2F984AB74E4BCE5',
    clientToken: 'Fc78d61c833db4b50864816b70766aee8S',
    name: 'Central WhatsApp • Amábile Barbarotti',
    tenantId: 'tenant-amabile-barbarotti',
  },
};

export const DEFAULT_ZAPI_INSTANCE_ID = '3F1B67FC8139425171C79ED390C0144C';
export const DEFAULT_ZAPI_INSTANCE_TOKEN = '7A18BD2BADA4840FB0374499';
export const DEFAULT_ZAPI_CLIENT_TOKEN = 'Fc78d61c833db4b50864816b70766aee8S';

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

  // Evita mismatch entre ID e Token caso o ambiente ou o cliente mande o token de outra instância
  if (known && known.token && token !== known.token) {
    if (token === '550DBC07B2F984AB74E4BCE5' && instanceId === '3F1B67FC8139425171C79ED390C0144C') {
      token = known.token;
    } else if (token === '7A18BD2BADA4840FB0374499' && instanceId === '3F8144490C66805B4E3FD64A35E2F2DC') {
      token = known.token;
    }
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
