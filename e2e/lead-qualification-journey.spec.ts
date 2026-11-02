import { test, expect } from '@playwright/test';
const { createQualificationJourney } = require('../tests/support/qualification-journey.cjs');
test('qualificação: evidência, proteção humana, revisão e persistência com APIs e banco reais isolados', async ({page}) => {
  test.setTimeout(90000);
  const journey=await createQualificationJourney();
  try {
    await journey.repo.writeCRMState(journey.tenantId,{contacts:[{...journey.contact,monthlyIncome:12000}],messages:[journey.message('client-financial','Quero comprar apartamento em Palhoça. Minha renda mensal é 5000. Entrada de 50 mil.') ]});
    await journey.service.runQualificationWorker(journey.tenantId);
    const tenant={id:journey.tenantId,name:'Qualificação fictícia',slug:'qualification',status:'ACTIVE',primaryColor:'#059669',timezone:'America/Sao_Paulo',featureFlags:{aiCopilot:true},aiConfig:{enabled:true},businessHours:{start:'08:00',end:'18:00',workDays:[1,2,3,4,5]},settings:{slaFirstResponseMinutes:15,slaInactivityHours:24,autoAssignRule:'UNASSIGNED_QUEUE',aiCopilotEnabled:true}};
    await page.setViewportSize({width:1600,height:1050});
    await page.addInitScript(tenant=>{localStorage.setItem('vanguard_crm_tenants',JSON.stringify([tenant]));localStorage.setItem('vanguard_crm_current_tenant',JSON.stringify(tenant));localStorage.setItem('faithhubs_view_mode','TENANT_CRM');},tenant);
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());const json=(data:any)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      if(url.pathname==='/api/v1/auth/session')return json({authenticated:true,user:journey.user});
      if(['/api/v1/crm/state','/api/v1/ai/qualification','/api/v1/ai/batch-qualify'].includes(url.pathname)){
        const response=await journey.request(url.pathname+url.search,request.method()==='GET'?undefined:request.postDataJSON(),journey.headers,request.method());
        return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
      }
      if(url.pathname==='/api/v1/webhooks/zapi/events')return json({success:true,tenantId:journey.tenantId,...await journey.repo.readCRMState(journey.tenantId),serverTime:Date.now()});
      if(/send-message|send-text|send-media/.test(url.pathname))throw new Error('Outbound forbidden in qualification journey');
      return json({success:true,tenantId:journey.tenantId,instances:[],items:[],data:[],users:[],contacts:[],conversations:[],messages:[]});
    });
    const open=async()=>{
      await page.goto('/');await page.getByRole('button',{name:'Expandir menu lateral',exact:true}).click();await page.getByRole('button',{name:'Inbox WhatsApp',exact:true}).click();
      await page.getByText('Cliente de qualificação fictício',{exact:true}).first().click();
      await page.getByRole('button',{name:'Qualificação do Lead',exact:true}).click();
      await expect(page.getByRole('region',{name:'Qualificação automática'})).toBeVisible();
    };
    await open();
    const panel=page.getByRole('region',{name:'Qualificação automática'});
    await expect(panel.getByText('Os dados já preenchidos foram preservados. Revise somente estas diferenças:',{exact:true})).toBeVisible();
    await expect(panel.getByText('Atual: R$ 12.000,00',{exact:true})).toBeVisible();
    await expect(panel.getByText('Identificado: R$ 5.000,00',{exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Usar informação da conversa',exact:true}).click();
    await expect(panel.getByRole('button',{name:'Usar informação da conversa',exact:true})).toHaveCount(0);
    await expect(page.getByRole('textbox',{name:'Renda mensal',exact:true})).toHaveValue('5.000');
    await panel.getByText('Origem das informações preenchidas',{exact:true}).click();await expect(panel.getByText(/Confirmado pela equipe/)).toBeVisible();
    await page.screenshot({path:'/tmp/brokiva-qualificacao-validada.png',fullPage:true});
    await open();await panel.getByText('Origem das informações preenchidas',{exact:true}).click();await expect(panel.getByText(/Confirmado pela equipe/)).toBeVisible();
    const state=await journey.repo.readCRMState(journey.tenantId);expect(state.contacts[0].monthlyIncome).toBe(5000);expect(state.contacts[0].qualificationFields.monthlyIncome.source).toBe('HUMAN');
    const entry=page.getByRole('textbox',{name:'Entrada disponível',exact:true});await entry.fill('0');await entry.press('Tab');
    await expect.poll(async()=>(await journey.repo.readCRMState(journey.tenantId)).contacts[0].downPaymentAvailable).toBe(0);
    await journey.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[journey.conversation.id],force:true});
    expect((await journey.repo.readCRMState(journey.tenantId)).contacts[0].downPaymentAvailable).toBe(0);

  } finally {await journey.close();}
});
