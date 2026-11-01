// Real application handlers + PostgreSQL-compatible isolated storage.
// The browser transport is adapted in Playwright; only external boundaries are simulated.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('../security/harness.cjs');
const tenantId='tenant-journey', userId='00000000-0000-4000-8000-000000000001';
async function createCampaignJourney() {
  const client=new PGlite(); let externalAttempts=0;
  for(const file of ['03_durable_crm_state.sql','04_campaigns.sql','05_campaign_sequences.sql']) await client.exec(fs.readFileSync(`database/${file}`,'utf8'));
  await client.exec(`CREATE TABLE tenants(id uuid PRIMARY KEY,name text,slug text,status text); CREATE TABLE users(id uuid PRIMARY KEY,full_name text,is_active boolean,phone text);
    CREATE TABLE memberships(tenant_id uuid,user_id uuid,role text,is_active boolean); CREATE TABLE whatsapp_instances(id uuid,tenant_id uuid,zapi_instance_id text,name text,phone_number text);
    INSERT INTO tenants VALUES ('10000000-0000-4000-8000-000000000001','Imobiliária Jornada','journey','ACTIVE');
    INSERT INTO users VALUES ('${userId}','Gestora Jornada',true,'5511987654321');
    INSERT INTO memberships VALUES ('10000000-0000-4000-8000-000000000001','${userId}','MANAGER',true);
    INSERT INTO whatsapp_instances VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','journey-instance','Linha fictícia','5511912345678');`);
  const h=harness({
    fetch:async url=>{
      const u=new URL(url);let data=[];
      if(u.pathname.endsWith('/tags')) data=[{id:'77',name:'Visita marcada'},{id:0,labelName:'Etiqueta zero'}];
      else if(u.pathname.endsWith('/chats')&&u.searchParams.get('page')==='1') data=[{phone:'5511998765010',name:'ZAPI Exemplo',labels:[77,{labelName:'Parceiro'},0],lastMessageTime:Date.now(),lastMessage:'Contato de teste'}];
      else if(!/\/(contacts|chats|tags|chats-messages)$/.test(u.pathname)) throw new Error('External request disabled');
      return {ok:true,json:async()=>data};
    },
    '@/lib/zapi-client':{ZApiClient:class {async getStatus(){return {success:true,data:{connected:true}};}async sendText(){externalAttempts++;throw new Error('Sending disabled in journey');}async sendImage(){externalAttempts++;throw new Error('Sending disabled in journey');}async sendVideo(){externalAttempts++;throw new Error('Sending disabled in journey');}}},
    '@/lib/db/zapi-credentials-service':{ZapiCredentialsService:{resolveCredentials:async ({tenantId:id})=>{if(id!==tenantId)throw new Error('Foreign tenant');return {instanceId:'journey-instance',instanceToken:'test-only',securityToken:'test-only'};}}},
  },{DATABASE_URL:'isolated-test-only',CAMPAIGNS_ENABLED:'true',CAMPAIGNS_OUTBOUND_ENABLED:'true',AUTOMATIONS_OUTBOUND_ENABLED:'false',AUTOMATIONS_CRON_SECRET:'test-only-secret-with-more-than-thirty-two-characters'});
  const schema=h.load('src/db/schema.ts');h.mocks['@/db'].db=drizzle(client,{schema});
  const session={userId,userEmail:'journey@example.invalid',userName:'Gestora Jornada',role:'MANAGER',tenantId};
  const auth=h.load('src/lib/api-auth.ts');
  const headers={authorization:`Bearer ${auth.signSessionPayload(session)}`,'x-tenant-id':tenantId};
  const routes={
    '/api/v1/campaigns':h.load('src/app/api/v1/campaigns/route.ts'),
    '/api/v1/crm/state':h.load('src/app/api/v1/crm/state/route.ts'),
    '/api/v1/sync/extension-history':h.load('src/app/api/v1/sync/extension-history/route.ts'),
    '/api/v1/zapi/preview-chats':h.load('src/app/api/v1/zapi/preview-chats/route.ts'),
    '/api/v1/zapi/batch-import':h.load('src/app/api/v1/zapi/batch-import/route.ts'),
  };
  const request=async(path,body,customHeaders=headers,method)=>{
    const route=routes[path.split('?')[0]], verb=method||(body===undefined?'GET':'POST');
    if(!route?.[verb]) throw new Error('Unhandled journey endpoint');
    return route[verb](h.request(path,body,customHeaders,verb));
  };
  const post=async(path,body)=>{const response=await request(path,body);const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;};
  const repo=h.load('src/lib/crm-repository.ts');
  const phones=['5511998765001','5511998765002','5511998765003','5511998765004','5511998765005','5511998765006'];
  const names=['WhatsApp Exemplo','CRM Exemplo','Legado Exemplo','Ambas Exemplo','Sem autorização','Pessoal Exemplo'];
  for(let index=0;index<phones.length;index++) await post('/api/v1/sync/extension-history',{chats:[{phone:phones[index],name:names[index],labels:index===0||index>=4?['Visita marcada']:index===3?['VIP']:[],messages:[]}]});
  let state=await repo.readCRMState(tenantId);
  const contacts=state.contacts.map((contact,index)=>({...contact,tags:index===1?['Retorno CRM']:index===2?['[Etiqueta] Visita marcada']:index===3?[' vip ']:[],whatsappLabels:index===0?[' Visita marcada ']:contact.whatsappLabels,isPersonal:index===5,temperature:'HOT'}));
  await post('/api/v1/crm/state',{contacts});
  for(const contact of contacts.slice(0,4)) await post('/api/v1/campaigns',{operation:'permission',contactId:contact.id,granted:true,confirmed:true,source:'Formulário fictício',notes:'Autorização fictícia para a jornada automatizada.'});
  await h.load('src/lib/automation-service.ts').runAutomationWorker(tenantId);
  return {tenantId,userId,session,headers,h,schema,client,repo,request,post,phones,names,get externalAttempts(){return externalAttempts;},close:()=>client.close()};
}
module.exports={createCampaignJourney};
