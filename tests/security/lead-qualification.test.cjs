const { test }=require('node:test');
const assert=require('node:assert/strict');
const { harness }=require('./harness.cjs');
const {createQualificationJourney}=require('../support/qualification-journey.cjs');
const core=harness().load('src/lib/lead-qualification.ts');
const m=(id,content,senderType='CONTACT',index=0)=>({id,content,senderType,timestamp:new Date(1760000000000+index*1000).toISOString()});
test('extração exige fala do cliente, incorpora correções e não transforma negação ou fornecedor em preferência',()=>{
 const result=core.explicitQualification([m('1','Quero comprar apartamento. Minha renda é 10000. Entrada de 100 mil.'),m('2','Corrigindo: minha renda é 5000. Entrada de 50 mil.','CONTACT',1),m('3','Orçamento de 700 mil em Palhoça.','USER',2)]);
 assert.equal(result.facts.monthlyIncome.value,5000);assert.equal(result.facts.downPaymentAvailable.value,50000);assert.equal(result.facts.maxPropertyValue,undefined);assert.equal(result.facts.monthlyIncome.messageId,'2');
 const negative=core.explicitQualification([m('1','Quero comprar casa. Não quero apartamento em Palhoça, procuro casa em São José.')]);
 assert.equal(negative.facts.preferredPropertyType.value,'HOUSE');assert.deepEqual(Array.from(negative.facts.targetRegions.value),['São José']);
 const vendor=core.explicitQualification([m('1','Sou fotógrafo. O ensaio do apartamento custa 800.')]);assert.equal(vendor.classification,'OPERATIONAL_OR_VENDOR');
 assert.equal(core.explicitQualification([m('1','Sou fotógrafo e quero comprar um apartamento para morar.')]).classification,'REAL_ESTATE_LEAD');
 const offer=core.explicitQualification([m('1','Apartamento com entrada de 100 mil.','USER'),m('2','Ainda não informei renda ou entrada.')]);assert.equal(offer.classification,'INSUFFICIENT_DATA');assert.equal(Object.keys(offer.facts).length,0);
});
test('evidência de IA: rejeita corretor, números inventados, tipos inválidos, negação e trecho ausente',()=>{
 const messages=[m('client','Minha renda mensal é 5000.'),m('broker','Orçamento de 700 mil.','USER')];
 const evidence=(field,value,messageId,quote)=>({field,value,messageId,quote,confidence:0.95});
 const facts=core.validatedModelFacts([evidence('monthlyIncome',5000,'client','Minha renda mensal é 5000.'),evidence('maxPropertyValue',700000,'broker','Orçamento de 700 mil.'),evidence('downPaymentAvailable',90000,'client','Minha renda mensal é 5000.')],messages);
 assert.equal(facts.monthlyIncome.value,5000);assert.equal(facts.maxPropertyValue,undefined);assert.equal(facts.downPaymentAvailable,undefined);
 assert.equal(Object.keys(core.validatedModelFacts([evidence('preferredPropertyType','INVALID','client','Minha renda mensal é 5000.')],messages)).length,0);
 assert.equal(Object.keys(core.validatedModelFacts([evidence('monthlyIncome',-1,'client','Minha renda mensal é 5000.')],messages)).length,0);
});
test('dados existentes e confirmações humanas, inclusive campos vazios, prevalecem sobre nova extração',()=>{
 const fact={value:5000,messageId:'1',quote:'Minha renda é 5000',at:'2026-01-01',source:'AI',confidence:0.9};
 const filled={monthlyIncome:12000,targetRegions:[]};
 assert.equal(core.applyQualification(filled,{monthlyIncome:fact}).contact.monthlyIncome,12000);
 assert.deepEqual(Array.from(core.applyQualification(filled,{monthlyIncome:fact}).conflicts),['monthlyIncome']);
 const human={monthlyIncome:undefined,targetRegions:[],qualificationFields:{monthlyIncome:{...fact,source:'HUMAN',value:''}}};assert.equal(core.applyQualification(human,{monthlyIncome:fact}).contact.monthlyIncome,undefined);
 const automatic={monthlyIncome:10000,targetRegions:[],qualificationFields:{monthlyIncome:{...fact,value:10000,at:'2025-01-01'}}};assert.equal(core.applyQualification(automatic,{monthlyIncome:fact}).contact.monthlyIncome,5000);
});
test('histórico completo por blocos, progresso durável, reinício, reimportação idempotente e importação antiga invalidam cache',async()=>{
 const f=await createQualificationJourney();try{
  const messages=[f.message('early','Quero comprar apartamento em Palhoça. Minha renda mensal é 10000. Entrada de 100 mil.'),...Array.from({length:45},(_,i)=>f.message(`routine-${i}`,'Pode enviar mais informações?','CONTACT',i+1))];
  await f.repo.writeCRMState(f.tenantId,{messages});
  let state=await f.service.runQualificationWorker(f.tenantId,{maxChunks:1});assert.equal(state.qualification.jobs[f.conversation.id].cursor,18);assert.equal(state.contacts[0].monthlyIncome,undefined);
  const fresh=harness(f.h.mocks,{DATABASE_URL:'test-only'});state=await fresh.load('src/lib/lead-qualification-service.ts').runQualificationWorker(f.tenantId);
  assert.equal(state.contacts[0].monthlyIncome,10000);assert.equal(state.contacts[0].downPaymentAvailable,100000);assert.equal(state.qualification.jobs[f.conversation.id].cursor,46);assert.equal(state.aiInsights[f.conversation.id].degraded,true);
  const calls=f.calls();await f.repo.writeCRMState(f.tenantId,{messages});await f.service.runQualificationWorker(f.tenantId);assert.equal(f.calls(),calls);
  await f.repo.writeCRMState(f.tenantId,{messages:[{...f.message('older','Meu orçamento é 500 mil.'),timestamp:'2025-01-01T12:00:00Z'}]});
  state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].maxPropertyValue,500000);assert.equal(state.contacts[0].monthlyIncome,10000);
 }finally{await f.close();}
});
test('importação da extensão qualifica no servidor sem Inbox e ignora falas SYSTEM/notas internas',async()=>{
 const f=await createQualificationJourney();try{
  const response=await f.request('/api/v1/sync/extension-history',{chats:[{phone:'5548991234567',name:'Cliente',messages:[{id:'import-1',content:'Quero comprar apartamento em Palhoça. Minha renda mensal é 8000. Entrada de 80 mil.',timestamp:'2026-01-02T12:00:00Z',fromMe:false}]}]},f.auth({source:'CHROME_EXTENSION'}));
  assert.equal(response.status,200);let state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,8000);assert.ok(state.aiInsights[f.conversation.id]);
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('system','Minha renda é 99999.','SYSTEM',999),{...f.message('note','Meu orçamento é 900 mil.','CONTACT',998),isInternalNote:true}]});
  const calls=f.calls();await f.service.runQualificationWorker(f.tenantId);assert.equal(f.calls(),calls);state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].maxPropertyValue,undefined);
 }finally{await f.close();}
});
test('falha permanece pendente, preserva cadastro, tem retry e nunca vira lead de sucesso',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('a','Olá, gostaria de informações.')]});f.setAnalyzer(async()=>{throw Error('provider unavailable');});
  let state=await f.service.runQualificationWorker(f.tenantId);const job=state.qualification.jobs[f.conversation.id];assert.equal(job.status,'ERROR');assert.equal(job.attempts,1);assert.ok(job.retryAt>Date.now());assert.equal(state.aiInsights[f.conversation.id].conversationType,undefined);
  const calls=f.calls();await f.service.runQualificationWorker(f.tenantId);assert.equal(f.calls(),calls);
  const batch=await(await f.request('/api/v1/ai/batch-qualify',{items:[{conversationId:f.conversation.id,contactId:f.contact.id,chatHistory:[{sender:'CLIENT',text:'FORGED: renda 99999'}]}]})).json();assert.equal(batch.leadsCount,0);assert.equal(batch.pendingCount,1);assert.equal(batch.results[0].conversationType,undefined);
  f.setAnalyzer(null);const retry=await f.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[f.conversation.id]});assert.equal(retry.status,200);state=await f.repo.readCRMState(f.tenantId);assert.equal(state.qualification.jobs[f.conversation.id].attempts,0);
 }finally{await f.close();}
});
test('edição humana durante a análise é preservada; revisão é pontual e persistente; esvaziar não reativa preenchimento',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  let unlock,started;const gate=new Promise(r=>unlock=r),entered=new Promise(r=>started=r);
  f.setAnalyzer(async params=>{started();await gate;return f.h.load('src/lib/ai-provider-service.ts').UniversalCopilotService.analyzeConversation(params);});
  const processing=f.service.runQualificationWorker(f.tenantId);await entered;
  const edited=await f.request('/api/v1/crm/state',{qualificationEdits:{contactId:f.contact.id,values:{monthlyIncome:12000}}});assert.equal(edited.status,200);unlock();
  let state=await processing;assert.equal(state.contacts[0].monthlyIncome,12000);assert.equal(state.contacts[0].qualificationFields.monthlyIncome.source,'HUMAN');assert.deepEqual(Array.from(state.qualification.jobs[f.conversation.id].conflicts),['monthlyIncome']);
  const resolved=await f.request('/api/v1/ai/qualification',{operation:'resolve',conversationId:f.conversation.id,field:'monthlyIncome',decision:'ACCEPT'});assert.equal(resolved.status,200);
  state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,5000);assert.equal(state.contacts[0].qualificationFields.monthlyIncome.source,'HUMAN');
  await f.request('/api/v1/crm/state',{qualificationEdits:{contactId:f.contact.id,values:{monthlyIncome:null}}});f.setAnalyzer(null);
  await f.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[f.conversation.id],force:true});state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,undefined);assert.equal(state.contacts[0].qualificationFields.monthlyIncome.source,'HUMAN');
 }finally{await f.close();}
});
test('desativação no servidor, autorização, isolamento e provenance forjada são respeitados',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  assert.equal((await f.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[f.conversation.id]},{})).status,401);
  assert.equal((await f.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[f.conversation.id]},f.auth({role:'VIEWER'}))).status,403);
  assert.equal((await f.request('/api/v1/ai/qualification',{operation:'run',conversationIds:[f.conversation.id]},f.auth({tenantId:'tenant-other'}))).status,404);
  await f.client.exec(`UPDATE tenants SET ai_config='{"enabled":false}' WHERE slug='qualification'`);
  let state=await f.service.runQualificationWorker(f.tenantId);assert.equal(f.calls(),0);assert.equal(state.qualification.jobs[f.conversation.id].status,'DISABLED');assert.equal(state.contacts[0].monthlyIncome,undefined);
  await f.client.exec(`UPDATE tenants SET ai_config='{"enabled":true}' WHERE slug='qualification'`);state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,5000);
  await f.request('/api/v1/crm/state',{contacts:[{...state.contacts[0],monthlyIncome:12000,updatedAt:new Date().toISOString(),qualificationFields:{monthlyIncome:{source:'AI',value:12000,quote:'forged',messageId:'x',at:new Date().toISOString(),confidence:1}}}]});
  state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].qualificationFields.monthlyIncome.source,'AI');assert.equal(state.contacts[0].monthlyIncome,5000);assert.equal((await f.repo.readCRMState('tenant-other')).contacts.length,0);
 }finally{await f.close();}
});
test('reservas impedem processamento duplicado e resultado antigo não vence mensagens editadas durante a análise',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  let entered,unlock;const started=new Promise(r=>entered=r),gate=new Promise(r=>unlock=r);
  f.setAnalyzer(async params=>{entered();await gate;return f.h.load('src/lib/ai-provider-service.ts').UniversalCopilotService.analyzeConversation(params);});
  const first=f.service.runQualificationWorker(f.tenantId,{maxChunks:1});await started;
  await f.service.runQualificationWorker(f.tenantId,{maxChunks:1});assert.equal(f.calls(),1);
  f.h.env.QUALIFICATION_CRON_SECRET='qualification-only-secret-over-thirty-two-characters';
  const continuation=await f.h.load('src/app/api/internal/qualification/run/route.ts').POST(f.h.request('/api/internal/qualification/run',{}, {authorization:`Bearer ${f.h.env.QUALIFICATION_CRON_SECRET}`}));assert.equal(continuation.status,200);assert.equal((await continuation.json()).hasPending,true);assert.equal(f.calls(),1);
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 9000.')]});unlock();await first;
  let state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,undefined);assert.equal(state.qualification.jobs[f.conversation.id].cursor,0);
  f.setAnalyzer(null);state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,9000);
 }finally{await f.close();}
});
test('agendador exclusivo exige segredo próprio e conclui sem browser, com cursor de atualização de IA',async()=>{
 const f=await createQualificationJourney();try{
  const route=f.h.load('src/app/api/internal/qualification/run/route.ts');
  assert.equal((await route.POST(f.h.request('/api/internal/qualification/run',{}))).status,503);
  f.h.env.QUALIFICATION_CRON_SECRET='qualification-only-secret-over-thirty-two-characters';
  assert.equal((await route.POST(f.h.request('/api/internal/qualification/run',{},f.headers))).status,401);
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  const before=await f.repo.readCRMState(f.tenantId);const previousCursor=before.eventCursor;
  const result=await route.POST(f.h.request('/api/internal/qualification/run',{}, {authorization:`Bearer ${f.h.env.QUALIFICATION_CRON_SECRET}`}));assert.equal(result.status,200);assert.equal((await result.json()).hasPending,false);
  const state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,5000);assert.ok(state.qualification.lastScheduledAt);assert.ok(state.eventCursor>previousCursor);
  const events=f.h.load('src/app/api/v1/webhooks/zapi/events/route.ts');
  const response=await events.GET(f.h.request(`/api/v1/webhooks/zapi/events?since=${previousCursor}`,undefined,f.headers));const data=await response.json();assert.equal(data.messages.length,0);assert.equal(data.contacts[0].monthlyIncome,5000);assert.ok(data.aiInsights[f.conversation.id]);
 }finally{await f.close();}
});
test('entrada zero explícita, renda em linguagem cotidiana e anúncio encaminhado não se confundem',()=>{
 const result=core.explicitQualification([m('1','Quero comprar apartamento. Ganho 7 mil por mês. Tenho 50 mil de entrada.'),m('2','Não tenho mais entrada.','CONTACT',1)]);
 assert.equal(result.facts.monthlyIncome.value,7000);assert.equal(result.facts.downPaymentAvailable.value,0);
 const listing=core.explicitQualification([m('1','Quero comprar apartamento. Encaminhado: oportunidade com entrada de 100 mil e orçamento de 500 mil.')]);
 assert.equal(listing.facts.downPaymentAvailable,undefined);assert.equal(listing.facts.maxPropertyValue,undefined);
});
test('extração contextual aceita somente valor sustentado por evidência e retoma IA após leitura básica temporária',async()=>{
 const f=await createQualificationJourney();try{
  const text='Quero comprar um imóvel. Meu salário líquido gira em torno de R$ 6.500 por mês.';
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('semantic',text)]});f.h.env.OPENAI_API_KEY='test-only-never-used';
  f.setAnalyzer(async()=>({summary:'Leitura básica temporária',analysisSource:'LOCAL_HEURISTICS',degraded:true,extractedData:{},responseOptions:[],detectedObjections:[],sentiment:'NEUTRAL',intent:'DUVIDA_GERAL',suggestedResponse:'',confidenceScore:60}));
  let state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,undefined);assert.ok(state.qualification.jobs[f.conversation.id].retryAt>Date.now());
  await f.repo.mutateCRMState(f.tenantId,state=>{state.qualification.jobs[f.conversation.id].retryAt=0;return state;});
  f.setAnalyzer(async()=>({summary:'Cliente busca imóvel e informou salário mensal.',conversationType:'REAL_ESTATE_LEAD',analysisSource:'OPENAI',degraded:false,extractedData:{monthlyIncome:999999},fieldEvidence:[{field:'monthlyIncome',value:6500,messageId:'semantic',quote:'Meu salário líquido gira em torno de R$ 6.500 por mês.',confidence:0.95}],responseOptions:[],detectedObjections:[],sentiment:'NEUTRAL',intent:'DUVIDA_GERAL',suggestedResponse:'',confidenceScore:90}));
  state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,6500);assert.equal(state.qualification.jobs[f.conversation.id].status,'UPDATED');assert.equal(state.contacts[0].qualificationFields.monthlyIncome.messageId,'semantic');assert.equal(state.qualification.jobs[f.conversation.id].degraded,false);
 }finally{await f.close();}
});
test('pausar IA durante processamento descarta o resultado e preserva a qualificação até reativar',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  let entered,unlock;const started=new Promise(r=>entered=r),gate=new Promise(r=>unlock=r);
  f.setAnalyzer(async params=>{entered();await gate;return f.h.load('src/lib/ai-provider-service.ts').UniversalCopilotService.analyzeConversation(params);});
  const processing=f.service.runQualificationWorker(f.tenantId);await started;
  const pause=await f.request('/api/v1/crm/state',{conversations:[{...f.conversation,aiEnabled:false}]});assert.equal(pause.status,200);unlock();
  let state=await processing;assert.equal(state.qualification.jobs[f.conversation.id].status,'DISABLED');assert.equal(state.contacts[0].monthlyIncome,undefined);
  f.setAnalyzer(null);await f.request('/api/v1/crm/state',{conversations:[{...f.conversation,aiEnabled:true}]});state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,5000);
 }finally{await f.close();}
});
test('snapshot antigo em uma alteração de etiqueta não desfaz preenchimento automático',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});await f.service.runQualificationWorker(f.tenantId);
  const response=await f.request('/api/v1/crm/state',{contacts:[{...f.contact,monthlyIncome:1000,tags:['Etiqueta alterada'],updatedAt:new Date().toISOString()}]});assert.equal(response.status,200);
  const state=await f.repo.readCRMState(f.tenantId);assert.equal(state.contacts[0].monthlyIncome,5000);assert.equal(state.contacts[0].qualificationFields.monthlyIncome.source,'AI');assert.ok(state.contacts[0].tags.includes('Etiqueta alterada'));
 }finally{await f.close();}
});
test('classificação contextual sem afirmação explícita exige evidência do cliente, não oferta do corretor',()=>{
 const messages=[m('broker','Este apartamento tem dois quartos.','USER'),m('client','Esse apartamento aceita FGTS?')];
 assert.equal(core.validatedClassification({messageId:'broker',quote:'Este apartamento tem dois quartos.',confidence:0.99},'REAL_ESTATE_LEAD',messages),'INSUFFICIENT_DATA');
 assert.equal(core.validatedClassification({messageId:'client',quote:'Esse apartamento aceita FGTS?',confidence:0.95},'REAL_ESTATE_LEAD',messages),'REAL_ESTATE_LEAD');
 assert.equal(core.validatedClassification(undefined,'REAL_ESTATE_LEAD',messages),'INSUFFICIENT_DATA');
});
test('marcação pessoal confirmada pela equipe impede preenchimento comercial sem apagar dados anteriores',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{contacts:[{...f.contact,isPersonal:true,qualificationClassificationSource:'HUMAN',maxPropertyValue:600000}],messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  const state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.contacts[0].isPersonal,true);assert.equal(state.contacts[0].monthlyIncome,undefined);assert.equal(state.contacts[0].maxPropertyValue,600000);assert.equal(state.qualification.jobs[f.conversation.id].humanClassificationPreserved,true);
 }finally{await f.close();}
});
test('mensagem nova aproveita memória validada sem reler o histórico; alteração antiga invalida o prefixo',async()=>{
 const f=await createQualificationJourney();try{
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.'),...Array.from({length:39},(_,i)=>f.message(`follow-${i}`,'Pode enviar mais informações?','CONTACT',i+1))]});
  let state=await f.service.runQualificationWorker(f.tenantId);assert.equal(state.qualification.jobs[f.conversation.id].cursor,40);const calls=f.calls();
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('correction','Corrigindo: minha renda mensal é 9000.','CONTACT',100)]});
  state=await f.repo.readCRMState(f.tenantId);assert.equal(state.qualification.jobs[f.conversation.id].cursor,40);
  state=await f.service.runQualificationWorker(f.tenantId);assert.equal(f.calls(),calls+1);assert.equal(state.contacts[0].monthlyIncome,9000);
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 6000.')]});
  state=await f.repo.readCRMState(f.tenantId);assert.equal(state.qualification.jobs[f.conversation.id].cursor,0);
 }finally{await f.close();}
});
test('provedor compartilha o limite de tempo entre tentativas e preserva contingência na importação curta',async()=>{
 const attempts=[];
 const h=harness({fetch:async(_url,options)=>{attempts.push(options.signal);return new Promise((resolve,reject)=>{
  if(options.signal.aborted)return reject(options.signal.reason);
  options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
 });}},{GEMINI_API_KEY:'synthetic-only-key'});
 const started=Date.now();const pending=h.load('src/lib/ai-provider-service.ts').UniversalCopilotService.analyzeConversation({chatHistory:[{sender:'CLIENT',text:'Quero comprar apartamento. Minha renda é 5000.'}],timeoutMs:1000});
 const keepAlive=setTimeout(()=>{},2000);
 try{const analysis=await pending;assert.equal(analysis.analysisSource,'LOCAL_HEURISTICS');assert.equal(analysis.extractedData.monthlyIncome,5000);assert.ok(Date.now()-started<2500);assert.ok(attempts.length>=1);assert.ok(attempts.every(signal=>signal===attempts[0]));}finally{clearTimeout(keepAlive);}
});
test('execução curta não reserva outro bloco de IA sem tempo para concluir; fila permanece retomável',async()=>{
 const f=await createQualificationJourney();try{
  f.h.env.GEMINI_API_KEY='synthetic-only-key';
  await f.repo.writeCRMState(f.tenantId,{messages:[f.message('lead','Quero comprar apartamento. Minha renda mensal é 5000.')]});
  const state=await f.service.runQualificationWorker(f.tenantId,{deadline:Date.now()+7000});
  assert.equal(f.calls(),0);assert.equal(state.qualification.jobs[f.conversation.id].status,'QUEUED');assert.equal(state.qualification.jobs[f.conversation.id].cursor,0);assert.equal(state.qualification.jobs[f.conversation.id].lease,undefined);
 }finally{await f.close();}
});
