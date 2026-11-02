const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { harness } = require('../security/harness.cjs');
async function createQualificationJourney() {
  const client = new PGlite();
  await client.exec(fs.readFileSync('database/03_durable_crm_state.sql','utf8'));
  await client.exec(`CREATE TABLE tenants (id uuid PRIMARY KEY, slug text, status text, ai_config jsonb);
    INSERT INTO tenants VALUES ('10000000-0000-4000-8000-000000000001','qualification','ACTIVE','{"enabled":true}'), ('10000000-0000-4000-8000-000000000002','other','ACTIVE','{"enabled":true}');`);
  let analyzer; let calls = 0;
  const h = harness({ '@/lib/ai-provider-service': { UniversalCopilotService: { analyzeConversation: async params => { calls++; return analyzer ? analyzer(params) : h.load('src/lib/ai-provider-service.ts').UniversalCopilotService.analyzeConversation(params); } } } }, { DATABASE_URL:'test-only' });
  h.mocks['@/db'].db = drizzle(client, { schema:h.load('src/db/schema.ts') });
  const tenantId='tenant-qualification';
  const user={userId:'00000000-0000-4000-8000-000000000001',userEmail:'qualification@example.invalid',userName:'Gestor fictício',role:'MANAGER',tenantId};
  const auth=payload=>({ authorization:`Bearer ${h.load('src/lib/api-auth.ts').signSessionPayload({...user,...payload})}` });
  const headers=auth();
  const repo=h.load('src/lib/crm-repository.ts');
  const service=h.load('src/lib/lead-qualification-service.ts');
  const contact={id:'qualification-contact',tenantId,name:'Cliente de qualificação fictício',phone:'+5548991234567',monthlyIncome:undefined,targetRegions:[],source:'WHATSAPP',temperature:'COLD',aiPriorityScore:0,tags:[],notesCount:0,consentGiven:false,hasOptedOut:false,isPersonal:false,createdAt:'2026-01-01T12:00:00Z',updatedAt:'2026-01-01T12:00:00Z'};
  const conversation={id:'qualification-conversation',tenantId,contactId:contact.id,instanceId:'fixture-instance',status:'OPEN',unreadCount:0,lastMessageAt:'2026-01-01T12:00:00Z',lastMessagePreview:'Quero comprar apartamento',slaBreached:false};
  await repo.writeCRMState(tenantId,{contacts:[contact],conversations:[conversation]});
  const message=(id,content,senderType='CONTACT',index=0)=>({id,tenantId,conversationId:conversation.id,senderType,senderName:'Cliente fictício',messageType:'TEXT',content,status:'DELIVERED',isInternalNote:false,timestamp:new Date(Date.parse('2026-01-01T12:00:00Z')+index*1000).toISOString()});
  const request=async(path,body,customHeaders=headers,method)=>{
    const url=new URL(path,'https://crm.test');
    const file={ '/api/v1/crm/state':'src/app/api/v1/crm/state/route.ts','/api/v1/ai/qualification':'src/app/api/v1/ai/qualification/route.ts','/api/v1/ai/batch-qualify':'src/app/api/v1/ai/batch-qualify/route.ts','/api/v1/sync/extension-history':'src/app/api/v1/sync/extension-history/route.ts' }[url.pathname];
    const route=h.load(file);const verb=method||(body===undefined?'GET':'POST');
    return route[verb](h.request(path,body,customHeaders,verb));
  };
  return {h,client,tenantId,user,headers,auth,repo,service,contact,conversation,message,request,setAnalyzer:fn=>{analyzer=fn;},calls:()=>calls,close:()=>client.close()};
}
module.exports={createQualificationJourney};
