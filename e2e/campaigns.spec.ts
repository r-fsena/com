import { test, expect } from '@playwright/test';
const tenantId = 'tenant-campaign-ux';
const user = { id: '00000000-0000-4000-8000-000000000001', name: 'Gestora de exemplo' };
const tenant = { id: tenantId, slug: 'campaign-ux', name: 'Imobiliária de exemplo', documentCnpj: '', primaryColor: '#6366f1', timezone: 'America/Sao_Paulo', status: 'ACTIVE', plan: 'PROFESSIONAL', maxBrokers: 5, maxInstances: 1,
  monthlyFee: 0, featureFlags: { campaigns: true }, businessHours: { start: '08:00', end: '18:00', workDays: [1, 2, 3, 4, 5] }, settings: { slaFirstResponseMinutes: 15, slaInactivityHours: 24, autoAssignRule: 'UNASSIGNED_QUEUE', aiCopilotEnabled: false, requireHumanApprovalForAI: true } };
const audience = { total: 2, eligible: 1, excluded: 1, rows: [{ id: 'one', name: 'Marina Exemplo', phone: '5511998765432', eligible: true, reason: '' }, { id: 'two', name: 'Contato pessoal de exemplo', phone: '5511998765000', eligible: false, reason: 'Contato pessoal' }] };
test.describe('Campanhas guiadas com dados fictícios e APIs isoladas', () => {
  test.beforeEach(async ({ page }) => {
    let campaigns: any[] = [];
    await page.addInitScript(tenant => { localStorage.setItem('vanguard_crm_tenants', JSON.stringify([tenant])); localStorage.setItem('vanguard_crm_current_tenant', JSON.stringify(tenant)); localStorage.setItem('faithhubs_view_mode', 'TENANT_CRM'); }, tenant);
    await page.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const json = (value: any, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (path === '/api/v1/auth/session') return json({ authenticated: true, user: { userId: user.id, userName: user.name, userEmail: 'ux@example.invalid', role: 'MANAGER', tenantId, isSuperAdmin: false } });
      if (path === '/api/v1/campaigns') {
        if (request.method() === 'GET') {
          if (new URL(request.url()).searchParams.has('id')) return json({ success: true, tenantId, campaign: campaigns[0], recipients: [], total: 0, offset: 0, nextOffset: null });
          return json({ success: true, tenantId, campaigns, contacts: [{ id: 'one', name: 'Marina Exemplo', phone: '+5511998765432', tags: ['Interessado'], targetRegions: ['Centro'] }, { id: 'two', name: 'Contato pessoal de exemplo', phone: '+5511998765000', isPersonal: true }],
            connections: [{ id: 'instance-one', name: 'Linha Comercial', phone: '+5511912345678' }], members: [user], ownPhone: '5511987654321', permissions: {}, pipelines: [], nextOffset: null,
            capabilities: { workerReady: true, outboundEnabled: true, storageReady: false } });
        }
        const body = request.postDataJSON();
        if (body.operation === 'permission') return json({ success: true, tenantId });
        if (body.operation === 'preview') return json({ success: true, tenantId, audience });
        if (body.operation === 'check-connection') return json({ success: true, tenantId, connected: true });
        if (body.operation === 'save') {
          const old = campaigns.find(item => item.id === body.id);
          const campaign = { id: old?.id || 'campaign-fixture', status: 'DRAFT', payload: { config: body.config, revision: (old?.payload.revision || 0) + 1, audit: [] }, counts: {} };
          campaigns = [campaign, ...campaigns.filter(item => item.id !== campaign.id)]; return json({ success: true, tenantId, campaign });
        }
        const campaign = campaigns.find(item => item.id === body.id);
        if (body.operation === 'simulate') return json({ success: true, tenantId, campaign, simulation: { audience, sample: [{ name: 'Marina Exemplo', message: 'Olá Marina, aqui é da Imobiliária de exemplo.', parts: campaign.payload.config.parts?.map((part: any) => ({ ...part, message: part.message.replace('{{primeiro_nome}}', 'Marina') })) }], warning: 'Nenhuma mensagem foi enviada. A simulação verifica o público e a personalização.' } });
        if (body.operation === 'start') campaign.status = 'RUNNING';
        if (body.operation === 'pause') campaign.status = 'PAUSED';
        if (body.operation === 'resume') campaign.status = 'RUNNING';
        if (body.operation === 'cancel') campaign.status = 'CANCELLED';
        return json({ success: true, tenantId, campaign });
      }
      if (path === '/api/v1/crm/state' || path === '/api/v1/webhooks/zapi/events') return json({ success: true, tenantId, contacts: [], conversations: [], messages: [], deals: [], tasks: [], quickReplies: [], aiInsights: {}, serverTime: 1 });
      return json({ success: true, tenantId, instances: [], jobs: [], contacts: [], conversations: [], messages: [], items: [], data: [], users: [] });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Expandir menu lateral', exact: true }).click();
    await page.getByRole('button', { name: 'Campanhas em Lote', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Campanhas de WhatsApp', exact: true })).toBeVisible();
  });
  test('cria, confere destinatários, simula, confirma, pausa e retoma', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByRole('button', { name: 'Apresentar um imóvel', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da campanha', exact: true }).fill('Novidades para interessados');
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('button', { name: 'Conferir destinatários', exact: true }).click();
    await expect(page.getByText('2 encontrados · 1 elegíveis · 1 não selecionados', { exact: true })).toBeVisible();
    await expect(page.getByText('Contato pessoal', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mensagem 1', exact: true }).fill('Olá {{primeiro_nome}}, temos novidades. Responda SAIR para não receber mais.');
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('combobox', { name: 'Linha que enviará a campanha', exact: true }).selectOption('instance-one');
    await page.getByRole('button', { name: 'Verificar conexão', exact: true }).click();
    await expect(page.getByText('Linha conectada na última verificação.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmar e iniciar campanha', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Testar sem enviar', exact: true }).click();
    await expect(page.getByText('Simulação concluída. Nenhuma mensagem foi enviada.', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: /Confirmo o envio real de 1 mensagem.*por contato para 1 contato/ }).check();
    await page.screenshot({ path: '/tmp/brokiva-campanhas-conferencia.png', fullPage: true });
    await page.getByRole('button', { name: 'Confirmar e iniciar campanha', exact: true }).click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retomar', exact: true }).click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
  });
  test('erro de gravação conserva a mensagem e não confirma sucesso', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da campanha', exact: true }).fill('Rascunho preservado');
    await page.route('**/api/v1/campaigns', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Banco indisponível. Nenhuma alteração confirmada.' }) }) : route.fallback());
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nenhuma alteração confirmada' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nome da campanha', exact: true })).toHaveValue('Rascunho preservado');
    await expect(page.getByText('Rascunho salvo no servidor.', { exact: false })).toHaveCount(0);
  });
  test('autorização precisa de origem, descrição e confirmação explícita', async ({ page }) => {
    await page.getByRole('button', { name: 'Autorizações', exact: true }).click();
    await page.getByRole('combobox', { name: 'Contato', exact: true }).selectOption('one');
    await page.getByRole('textbox', { name: 'Origem do registro', exact: true }).fill('Formulário do site');
    await page.getByRole('textbox', { name: 'Como e quando essa preferência foi informada?', exact: true }).fill('Marina autorizou novidades pelo formulário em 31/10/2026.');
    await expect(page.getByRole('button', { name: 'Registrar preferência', exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: /Confirmo que estou registrando uma preferência informada/ }).check();
    await page.getByRole('button', { name: 'Registrar preferência', exact: true }).click();
    await expect(page.getByText('Preferência registrada.', { exact: false })).toBeVisible();
  });
  test('campos de mensagem e confirmação funcionam em tela pequena', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByRole('button', { name: 'Convidar para uma visita', exact: true }).click();
    await page.getByRole('button', { name: '3. Mensagem', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem 1', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Mensagem 1', exact: true }).fill('Olá {{nome}}, gostaria de agendar uma visita?');
    await expect(page.getByText('Olá Marina Exemplo, gostaria de agendar uma visita?', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/brokiva-campanhas-mobile.png', fullPage: true });
  });
  test('monta cinco blocos, muda a ordem e o intervalo, salva e reabre sem perder a sequência', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da campanha', exact: true }).fill('Sequência com timer');
    await page.getByRole('button', { name: '3. Mensagem', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mensagem 1', exact: true }).fill('Primeira parte para {{primeiro_nome}}');
    for (let index=2; index<=5; index++) {
      await page.getByRole('button', { name: 'Adicionar mensagem', exact: true }).click();
      await page.getByRole('textbox', { name: `Mensagem ${index}`, exact: true }).fill(`Parte ${index}`);
    }
    await expect(page.getByRole('button', { name: 'Adicionar mensagem', exact: true })).toBeDisabled();
    await page.getByRole('spinbutton', { name: 'Intervalo entre mensagens (segundos)', exact: true }).fill('60');
    await page.getByRole('button', { name: 'Mover mensagem 3 para cima', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem 2', exact: true })).toHaveValue('Parte 3');
    await expect(page.getByRole('textbox', { name: 'Mensagem 3', exact: true })).toHaveValue('Parte 2');
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByText('Rascunho salvo no servidor. Nenhum disparo foi iniciado.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: '3. Mensagem', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem 2', exact: true })).toHaveValue('Parte 3');
    await expect(page.getByRole('spinbutton', { name: 'Intervalo entre mensagens (segundos)', exact: true })).toHaveValue('60');
    await page.getByRole('button', { name: '5. Conferir e enviar', exact: true }).click();
    await expect(page.getByText(/5 mensagens por contato.*intervalo mínimo de 1 minuto/)).toBeVisible();
    await page.screenshot({ path: '/tmp/brokiva-sequencia-conferencia.png', fullPage: true });
  });
  test('mensagem vazia e timer abaixo do mínimo impedem salvar; remover preserva as outras partes no celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Criar campanha', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da campanha', exact: true }).fill('Sequência móvel');
    await page.getByRole('button', { name: '3. Mensagem', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mensagem 1', exact: true }).fill('Olá {{primeiro_nome}}!');
    await page.getByRole('button', { name: 'Adicionar mensagem', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Escreva a mensagem' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Mensagem 2', exact: true }).fill('Posso enviar os detalhes?');
    await page.getByRole('spinbutton', { name: 'Intervalo entre mensagens (segundos)', exact: true }).fill('0');
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'intervalo mínimo' })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Intervalo entre mensagens (segundos)', exact: true }).fill('30');
    await page.getByRole('spinbutton', { name: 'Intervalo entre mensagens (segundos)', exact: true }).click();
    await page.mouse.wheel(0, 200);
    await page.screenshot({ path: '/tmp/brokiva-sequencia-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Remover mensagem 1', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem 1', exact: true })).toHaveValue('Posso enviar os detalhes?');
    await expect(page.getByRole('button', { name: 'Remover mensagem 1', exact: true })).toBeDisabled();
  });

});
