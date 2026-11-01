import { test, expect } from '@playwright/test';

const tenantId = 'tenant-ux-test';
const member = { id: '00000000-0000-4000-8000-000000000001', name: 'Gestora de exemplo' };
const tenant = { id: tenantId, slug: 'ux-test', name: 'Imobiliária de exemplo', documentCnpj: '', primaryColor: '#6366f1', timezone: 'America/Sao_Paulo', status: 'ACTIVE', plan: 'PROFESSIONAL',
  maxBrokers: 5, maxInstances: 1, monthlyFee: 0, featureFlags: { automations: true }, businessHours: { start: '08:00', end: '18:00', workDays: [1, 2, 3, 4, 5] },
  settings: { slaFirstResponseMinutes: 15, slaInactivityHours: 24, autoAssignRule: 'UNASSIGNED_QUEUE', aiCopilotEnabled: false, requireHumanApprovalForAI: true } };

test.describe('Configuração guiada de automações, sem serviços externos', () => {
  test.beforeEach(async ({ page }) => {
    let rules: any[] = [];
    const audit: any[] = [];
    await page.addInitScript(tenant => {
      localStorage.setItem('vanguard_crm_tenants', JSON.stringify([tenant]));
      localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(tenant));
      localStorage.setItem('faithhubs_view_mode', 'TENANT_CRM');
    }, tenant);
    // Every API is intercepted: the UI test cannot send messages, invite users or touch production.
    await page.route('**/api/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      const json = (body: any, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/api/v1/auth/session') return json({ authenticated: true, user: { userId: member.id, userName: member.name, userEmail: 'ux@example.invalid', role: 'MANAGER', tenantId, isSuperAdmin: false } });
      if (path === '/api/v1/automations') {
        if (request.method() === 'GET') return json({ success: true, tenantId, rules, jobs: [], audit, members: [member], capabilities: { workerReady: false, outboundEnabled: false } });
        const input = request.postDataJSON();
        if (input.operation === 'save') {
          const old = rules.find(rule => rule.id === input.id);
          const rule = { ...old, id: old?.id || '00000000-0000-4000-8000-000000000005', tenantId, revision: (old?.revision || 0) + 1,
            status: old?.status || 'DRAFT', draft: input.config, updatedAt: new Date().toISOString() };
          rules = [rule, ...rules.filter(item => item.id !== rule.id)]; return json({ success: true, tenantId, rule });
        }
        const rule = rules.find(item => item.id === input.id);
        if (input.operation === 'simulate') {
          rule.testedRevision = rule.revision;
          return json({ success: true, tenantId, rule, simulation: { matches: true, contactName: 'Cliente fictício de exemplo', reason: 'O contato atende aos critérios.', warning: 'Simulação: nenhum envio ou alteração de contato foi realizado.',
            actions: rule.draft.actions.map((action: any) => ({ type: action.type, text: action.message || action.title || action.tag })) } });
        }
        if (input.operation === 'publish') { rule.status = 'ACTIVE'; rule.published = structuredClone(rule.draft); rule.publishedRevision = rule.revision; }
        if (input.operation === 'pause') { rule.status = 'PAUSED'; rule.revision++; }
        if (input.operation === 'archive') rule.status = 'ARCHIVED';
        return json({ success: true, tenantId, rule });
      }
      if (path === '/api/v1/crm/state' || path === '/api/v1/webhooks/zapi/events') return json({ success: true, tenantId, contacts: [], conversations: [], messages: [], deals: [], tasks: [], quickReplies: [], aiInsights: {}, serverTime: 1 });
      return json({ success: true, tenantId, instances: [], jobs: [], contacts: [], conversations: [], messages: [], items: [], data: [], users: [] });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Expandir menu lateral', exact: true }).click();
    await page.getByRole('button', { name: /Automações & Regras/i }).click();
    await expect(page.getByRole('heading', { name: 'Automações e regras comerciais' })).toBeVisible();
  });

  test('cria, testa sem envio, ativa, edita um rascunho e pausa', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Crie sua primeira automação' })).toBeVisible();
    await page.getByRole('button', { name: 'Criar automação', exact: true }).click();
    await page.getByRole('button', { name: 'Receber novos interessados', exact: true }).click();
    await page.getByLabel('Nome da regra', { exact: true }).fill('Boas-vindas da equipe');
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar critério', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Valor', exact: true })).toHaveValue('WHATSAPP');
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill('Olá {{nome}}, podemos ajudar na busca do seu imóvel?');
    await expect(page.getByText('Cria uma tarefa na agenda com o texto para o corretor revisar. Nenhuma mensagem é enviada automaticamente.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(page.getByLabel('Executar somente no horário de atendimento')).toBeDisabled();
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ativar esta versão', exact: true })).toBeDisabled();
    await page.screenshot({ path: '/tmp/brokiva-automacoes-conferencia.png', fullPage: true });
    await page.getByRole('button', { name: 'Testar sem enviar', exact: true }).click();
    await expect(page.getByText('Teste concluído sem enviar mensagens ou alterar contatos.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ativar esta versão', exact: true }).click();
    await expect(page.getByText('Ativa', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Nome da regra', { exact: true }).fill('Boas-vindas ajustadas');
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByText('Rascunho salvo no servidor. A versão ativa, quando existir, continua em uso.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Boas-vindas da equipe', exact: true })).toBeVisible();
    await expect(page.getByText('Há um rascunho para revisar. A versão anterior continua ativa.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
  });

  test('falha de gravação mantém o formulário e permite tentar novamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar automação', exact: true }).click();
    await page.getByLabel('Nome da regra', { exact: true }).fill('Teste de recuperação');
    await page.route('**/api/v1/automations', async route => {
      if (route.request().method() === 'POST') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Banco indisponível. Nenhuma alteração confirmada.' }) });
      return route.fallback();
    });
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nenhuma alteração confirmada' })).toBeVisible();
    await expect(page.getByLabel('Nome da regra', { exact: true })).toHaveValue('Teste de recuperação');
    await expect(page.getByText('Rascunho salvo no servidor.', { exact: false })).toHaveCount(0);
  });

  test('configuração funciona em tela pequena com campos rotulados', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Criar automação', exact: true }).click();
    await page.getByRole('button', { name: 'Lembrar primeiro atendimento', exact: true }).click();
    await page.getByRole('button', { name: '3. Ações', exact: true }).click();
    await expect(page.getByLabel('O que lembrar?', { exact: true })).toBeVisible();
    await page.getByLabel('Prazo em horas após a criação', { exact: true }).fill('4');
    await expect(page.getByLabel('Prazo em horas após a criação', { exact: true })).toHaveValue('4');
    await page.screenshot({ path: '/tmp/brokiva-automacoes-mobile.png', fullPage: true });
  });
});
