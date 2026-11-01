const { test }=require('node:test');
const assert=require('node:assert/strict');
const { harness }=require('./harness.cjs');
const { createCampaignJourney }=require('../support/campaign-journey.cjs');

test('etiquetas de campanhas unem WhatsApp, CRM e prefixos legados sem confundir nomes parecidos',()=>{
  const labels=harness().load('src/lib/contact-labels.ts');
  const contacts=[{id:'1',tags:['[Etiqueta] Visita marcada',' VIP ','VIP'],whatsappLabels:['  Visita   marcada ']},{id:'2',tags:['Retorno CRM'],whatsappLabels:[]}];
  const choices=labels.campaignLabelOptions(contacts);
  assert.equal(choices.length,3);assert.equal(choices.find(x=>x.id==='visita marcada').count,1);
  assert.equal(labels.campaignLabelKey('VISITA   MARCADA'),'visita marcada');
  assert.notEqual(labels.campaignLabelKey('VIP'),labels.campaignLabelKey('Não VIP'));
  assert.deepEqual(Array.from(labels.resolveWhatsAppLabels([0,{labelId:1},{labelName:' Parceiro '},'Direta','999',{}],new Map([['0','Zero'],['1','Visita']]))),['Zero','Visita','Parceiro','Direta']);
});

test('jornada real de etiquetas: extensão, cadastro interno, simulação, persistência e bloqueios de segurança',async()=>{
  const f=await createCampaignJourney();
  try{
    let state=await f.repo.readCRMState(f.tenantId);assert.ok(state.contacts[0].whatsappLabels.includes(' Visita marcada '));
    const catalog=await(await f.request('/api/v1/campaigns')).json();assert.equal(catalog.contacts[0].whatsappLabels[0],' Visita marcada ');
    const base={name:'Jornada de etiquetas',objective:'CUSTOM',instanceId:'journey-instance',audience:{mode:'FILTERED',tags:['VISITA MARCADA']},message:'Olá {{primeiro_nome}}',schedule:{hours:{onlyBusinessHours:false,timezone:'America/Sao_Paulo',start:'08:00',end:'18:00',workDays:[1,2,3,4,5]},expiresAfterHours:48}};
    let preview=await f.post('/api/v1/campaigns',{operation:'preview',config:base});assert.equal(preview.audience.total,4);assert.equal(preview.audience.eligible,2);assert.equal(preview.audience.excluded,2);
    assert.deepEqual(preview.audience.rows.filter(row=>row.eligible).map(row=>row.name).sort(),['Legado Exemplo','WhatsApp Exemplo']);
    preview=await f.post('/api/v1/campaigns',{operation:'preview',config:{...base,audience:{mode:'FILTERED',tags:['retorno crm']}}});assert.equal(preview.audience.eligible,1);assert.equal(preview.audience.rows[0].name,'CRM Exemplo');
    preview=await f.post('/api/v1/campaigns',{operation:'preview',config:{...base,audience:{mode:'FILTERED',tags:['Visita marcada','Retorno CRM'],temperatures:['COLD']}}});assert.equal(preview.audience.eligible,0);
    let saved=await f.post('/api/v1/campaigns',{operation:'save',config:base});
    const simulated=await f.post('/api/v1/campaigns',{operation:'simulate',id:saved.campaign.id,revision:1});assert.equal(simulated.simulation.audience.eligible,2);assert.equal(f.externalAttempts,0);
    const reloaded=await(await f.request('/api/v1/campaigns')).json();assert.equal(reloaded.campaigns[0].payload.config.audience.tags[0],'VISITA MARCADA');
    await f.post('/api/v1/sync/extension-history',{chats:[{phone:f.phones[1],labels:['Nova etiqueta WA'],messages:[]}]});
    state=await f.repo.readCRMState(f.tenantId);const crm=state.contacts.find(c=>c.phone.replace(/\D/g,'')===f.phones[1]);assert.ok(crm.tags.includes('Retorno CRM'));assert.ok(crm.whatsappLabels.includes('Nova etiqueta WA'));
    const foreign=await f.request('/api/v1/campaigns',undefined,{...f.headers,'x-tenant-id':'tenant-other'});assert.equal(foreign.status,403);
    f.h.env.CAMPAIGNS_OUTBOUND_ENABLED='false';const blocked=await f.request('/api/v1/campaigns',{operation:'start',id:saved.campaign.id,revision:1,confirmed:true,confirmedCount:2});assert.equal(blocked.status,409);assert.equal(f.externalAttempts,0);
  }finally{await f.close();}
});

test('etiquetas da Z-API passam pelo preview e importação e não substituem etiquetas internas na reimportação',async()=>{
  const f=await createCampaignJourney();
  try{
    const preview=await f.post('/api/v1/zapi/preview-chats',{});assert.equal(preview.chats.length,1);assert.deepEqual(preview.chats[0].whatsappLabels,['Visita marcada','Parceiro','Etiqueta zero']);
    const imported=await f.post('/api/v1/zapi/batch-import',{items:[preview.chats[0]]});const contact=imported.contacts[0];
    await f.post('/api/v1/crm/state',{contacts:[{...contact,tags:[...contact.tags,'Etiqueta interna mantida'],updatedAt:new Date().toISOString()}]});
    await f.post('/api/v1/zapi/batch-import',{items:[{...preview.chats[0],whatsappLabels:['Nova etiqueta WA']}]});
    const state=await f.repo.readCRMState(f.tenantId);const current=state.contacts.find(c=>c.id===contact.id);assert.ok(current.tags.includes('Etiqueta interna mantida'));assert.ok(current.whatsappLabels.includes('Nova etiqueta WA'));
    assert.equal(f.externalAttempts,0);
  }finally{await f.close();}
});
