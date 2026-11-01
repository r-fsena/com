import { test, expect } from '@playwright/test';
const { createCampaignJourney } = require('../tests/support/campaign-journey.cjs');

// Campaign/import/state responses come from the real handlers and a real isolated
// PostgreSQL-compatible engine. Auth bootstrap and provider/network boundaries are controlled.
test.describe('Campanhas: jornada integrada de etiquetas, APIs reais e banco isolado', () => {
  let journey: any;
  test.beforeEach(async ({ page }) => {
    journey=await createCampaignJourney();
    const tenant={id:journey.tenantId,name:'Imobiliária Jornada',slug:'journey',status:'ACTIVE',primaryColor:'#6366f1',timezone:'America/Sao_Paulo',featureFlags:{campaigns:true},businessHours:{start:'08:00',end:'18:00',workDays:[1,2,3,4,5]},settings:{slaFirstResponseMinutes:15,slaInactivityHours:24,autoAssignRule:'UNASSIGNED_QUEUE',aiCopilotEnabled:false}};
    await page.addInitScript(tenant=>{localStorage.setItem('vanguard_crm_tenants',JSON.stringify([tenant]));localStorage.setItem('vanguard_crm_current_tenant',JSON.stringify(tenant));localStorage.setItem('faithhubs_view_mode','TENANT_CRM');},tenant);
    await page.route('**/api/**',async route=>{
      const req=route.request(), url=new URL(req.url());
      const json=(value:any,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(url.pathname==='/api/v1/auth/session')return json({authenticated:true,user:journey.session});
      if(['/api/v1/campaigns','/api/v1/crm/state'].includes(url.pathname)){
        const response=await journey.request(url.pathname+url.search,req.method()==='GET'?undefined:req.postDataJSON(),journey.headers,req.method());
        return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
      }
      if(url.pathname==='/api/v1/webhooks/zapi/events')return json({success:true,tenantId:journey.tenantId,...await journey.repo.readCRMState(journey.tenantId),serverTime:Date.now()});
      return json({success:true,tenantId:journey.tenantId,instances:[],jobs:[],items:[],data:[],users:[],contacts:[],conversations:[],messages:[]});
    });
    await page.goto('/');
    await page.getByRole('button',{name:'Expandir menu lateral',exact:true}).click();
    await page.getByRole('button',{name:'Campanhas em Lote',exact:true}).click();
    await expect(page.getByRole('button',{name:'Criar campanha',exact:true})).toBeEnabled();
  });
  test.afterEach(async()=>{expect(journey.externalAttempts).toBe(0);await journey.close();});

  test('etiquetas WhatsApp e CRM: seleção, exclusões, cinco partes, simulação, confirmação e cancelamento sem disparos',async({page})=>{
    await page.getByRole('button',{name:'Criar campanha',exact:true}).click();
    await page.getByRole('textbox',{name:'Nome da campanha',exact:true}).fill('E2E etiquetas: WhatsApp e CRM');
    await page.getByRole('button',{name:'2. Destinatários',exact:true}).click();
    await page.getByText('Etiquetas (qualquer)',{exact:true}).click();
    await expect(page.getByRole('checkbox',{name:'Visita marcada',exact:true})).toHaveCount(1);
    await expect(page.getByRole('checkbox',{name:'Retorno CRM',exact:true})).toBeVisible();
    await expect(page.getByRole('checkbox',{name:'VIP',exact:true})).toHaveCount(1);
    await expect(page.getByRole('checkbox',{name:'[Etiqueta] Visita marcada',exact:true})).toHaveCount(0);
    await page.getByRole('checkbox',{name:'Visita marcada',exact:true}).check();
    await page.getByRole('button',{name:'Conferir destinatários',exact:true}).click();
    await expect(page.getByText('4 encontrados · 2 elegíveis · 2 não selecionados',{exact:true})).toBeVisible();
    await expect(page.getByText('Autorização para campanhas não registrada',{exact:true})).toBeVisible();
    await expect(page.getByText('Contato pessoal',{exact:true})).toBeVisible();
    await page.getByRole('checkbox',{name:'Retorno CRM',exact:true}).check();
    await page.getByRole('button',{name:'Conferir destinatários',exact:true}).click();
    await expect(page.getByText('5 encontrados · 3 elegíveis · 2 não selecionados',{exact:true})).toBeVisible();
    await page.screenshot({path:'/tmp/brokiva-jornada-etiquetas.png',fullPage:true});
    await page.getByRole('button',{name:'3. Mensagem',exact:true}).click();
    await page.getByRole('textbox',{name:'Mensagem 1',exact:true}).fill('Olá {{primeiro_nome}} da {{empresa}}!');
    for(let index=2;index<=5;index++) {await page.getByRole('button',{name:'Adicionar mensagem',exact:true}).click();await page.getByRole('textbox',{name:`Mensagem ${index}`,exact:true}).fill(`Parte ${index} da campanha de teste.`);}
    await page.getByRole('spinbutton',{name:'Intervalo entre mensagens (segundos)',exact:true}).fill('60');
    await page.getByRole('button',{name:'4. Linha e horário',exact:true}).click();
    await page.getByRole('combobox',{name:'Linha que enviará a campanha',exact:true}).selectOption('journey-instance');
    await page.getByRole('button',{name:'5. Conferir e enviar',exact:true}).click();
    await page.getByRole('button',{name:'Testar sem enviar',exact:true}).click();
    await expect(page.getByText('3 destinatários elegíveis',{exact:true})).toBeVisible();
    await expect(page.getByText('Olá WhatsApp da Imobiliária Jornada!',{exact:true})).toBeVisible();
    let state=await(await journey.request('/api/v1/campaigns')).json();expect(state.campaigns).toHaveLength(1);
    const id=state.campaigns[0].id;expect((await(await journey.request(`/api/v1/campaigns?id=${id}`)).json()).total).toBe(0);
    await page.getByRole('checkbox',{name:/Confirmo o envio real de 5 mensagens por contato para 3 contatos/}).check();
    await page.getByRole('button',{name:'Confirmar e iniciar campanha',exact:true}).click();
    await expect(page.getByText('Em andamento',{exact:true})).toBeVisible();
    const queued=await(await journey.request(`/api/v1/campaigns?id=${id}`)).json();expect(queued.total).toBe(15);
    expect(new Set(queued.recipients.map((row:any)=>row.payload.name))).toEqual(new Set(['WhatsApp Exemplo','CRM Exemplo','Legado Exemplo']));
    await page.getByRole('button',{name:'Pausar',exact:true}).click();await expect(page.getByText('Pausada',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Retomar',exact:true}).click();await expect(page.getByText('Em andamento',{exact:true})).toBeVisible();
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Cancelar pendentes',exact:true}).click();await expect(page.getByText('Cancelada',{exact:true})).toBeVisible();
    const cancelled=await(await journey.request(`/api/v1/campaigns?id=${id}`)).json();expect(cancelled.recipients.every((row:any)=>row.status==='CANCELLED')).toBe(true);
  });

  test('rascunho reaparece com filtros marcados; público vazio e canal desabilitado não permitem iniciar',async({page})=>{
    journey.h.env.CAMPAIGNS_OUTBOUND_ENABLED='false';
    await page.getByRole('button',{name:'Atualizar campanhas',exact:true}).click();
    await page.getByRole('button',{name:'Criar campanha',exact:true}).click();
    await page.getByRole('textbox',{name:'Nome da campanha',exact:true}).fill('E2E persistência e bloqueios');
    await page.getByRole('button',{name:'2. Destinatários',exact:true}).click();
    await page.getByText('Etiquetas (qualquer)',{exact:true}).click();await page.getByRole('checkbox',{name:'Retorno CRM',exact:true}).check();
    await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.getByText('Rascunho salvo no servidor.',{exact:false})).toBeVisible();
    await page.reload();await page.getByRole('button',{name:'Expandir menu lateral',exact:true}).click();await page.getByRole('button',{name:'Campanhas em Lote',exact:true}).click();
    await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'2. Destinatários',exact:true}).click();
    await page.getByText('Etiquetas (1 selecionado)',{exact:true}).click();await expect(page.getByRole('checkbox',{name:'Retorno CRM',exact:true})).toBeChecked();
    await page.getByRole('button',{name:'Conferir destinatários',exact:true}).click();await expect(page.getByText('1 encontrados · 1 elegíveis · 0 não selecionados',{exact:true})).toBeVisible();
    await page.getByText('Interesse (qualquer)',{exact:true}).click();await page.getByRole('checkbox',{name:'Frio',exact:true}).check();
    await page.getByRole('button',{name:'Conferir destinatários',exact:true}).click();await expect(page.getByText('0 encontrados · 0 elegíveis · 0 não selecionados',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'5. Conferir e enviar',exact:true}).click();await page.getByRole('button',{name:'Testar sem enviar',exact:true}).click();
    await expect(page.getByText('0 destinatários elegíveis',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Confirmar e iniciar campanha',exact:true})).toBeDisabled();
  });
});
