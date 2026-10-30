import type { Tenant } from '@/types/crm';

export type TenantCatalogEntry = Pick<Tenant, 'id' | 'name' | 'slug' | 'documentCnpj' | 'logoUrl' | 'primaryColor' | 'timezone' | 'status' | 'businessHours'>;

export function tenantForAuthenticatedSession(tenantId: string, cached: Tenant[]): Tenant {
  const slug = tenantId.replace(/^tenant-/, '');
  const previous = cached.find(tenant => tenant.slug === slug);
  if (previous) return { ...previous, id: tenantId, slug };
  return { id: tenantId, slug, name: slug, documentCnpj: '', primaryColor: '#3742AC', timezone: 'America/Sao_Paulo', status: 'ACTIVE',
    plan: 'PROFESSIONAL', monthlyFee: 0, maxBrokers: 0, maxInstances: 0, catalogMetadataOnly: true,
    businessHours: { start: '08:30', end: '19:00', workDays: [1, 2, 3, 4, 5, 6] },
    settings: { slaFirstResponseMinutes: 15, slaInactivityHours: 24, autoAssignRule: 'ROUND_ROBIN', aiCopilotEnabled: true, requireHumanApprovalForAI: true } };
}

/** O servidor define o cadastro/ID; preferências locais só acompanham o mesmo slug. */
export function reconcileTenantCatalog(catalog: TenantCatalogEntry[], cached: Tenant[]): Tenant[] {
  return catalog.map(entry => {
    const previous = cached.find(tenant => tenant.slug === entry.slug || (tenant.id === entry.id && !tenant.slug));
    return {
      plan: previous?.plan || 'PROFESSIONAL',
      monthlyFee: previous?.monthlyFee ?? 0,
      maxBrokers: previous?.maxBrokers ?? 0,
      maxInstances: previous?.maxInstances ?? 0,
      featureFlags: previous?.featureFlags,
      settings: previous?.settings || { slaFirstResponseMinutes: 15, slaInactivityHours: 24, autoAssignRule: 'ROUND_ROBIN', aiCopilotEnabled: true, requireHumanApprovalForAI: true },
      catalogMetadataOnly: !previous?.plan || previous.catalogMetadataOnly === true,
      ...entry,
    };
  });
}

export function catalogTenantForSelection<T extends Pick<Tenant, 'id' | 'slug'>>(current: Pick<Tenant, 'id' | 'slug'>, catalog: T[]): T | undefined {
  // Um ID legado pode hoje pertencer a outra imobiliária; o slug explícito tem prioridade.
  return current.slug ? catalog.find(tenant => tenant.slug === current.slug) : catalog.find(tenant => tenant.id === current.id);
}
