import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { processZapiWebhookRequest } from '../src/lib/zapi-webhook-handler';
import { serverCRMStore } from '../src/lib/server-crm-store';
import { NextRequest } from 'next/server';

describe('Z-API Webhook & Message Sync Tests', () => {
  const connectedInstancePhone = '554899797603';
  const customerPhone = '5548988776655';

  after(() => {
    // Restaura o banco de dados oficial a partir do backup ao final dos testes
    if (fs.existsSync('data/crm-state.backup.json')) {
      const bkp = JSON.parse(fs.readFileSync('data/crm-state.backup.json', 'utf8'));
      bkp.state.contacts = bkp.state.contacts.filter((c: any) => !c.id.includes('554899797603') && !c.phone?.includes('554899797603') && c.name !== 'Amor 💙');
      bkp.state.conversations = bkp.state.conversations.filter((c: any) => !c.id.includes('554899797603') && !c.contactId?.includes('554899797603'));
      fs.writeFileSync('data/crm-state.json', JSON.stringify(bkp, null, 2), 'utf8');
    }
  });

  beforeEach(() => {
    // Reseta store em memória
    serverCRMStore.resetState();
  });

  test('Webhook with fromMe: true must target customer recipient, NEVER connected broker phone', async () => {
    // Simula mensagem enviada pelo corretor via WhatsApp Web / Celular
    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        messageId: 'msg-test-fromme-01',
        fromMe: true,
        senderPhone: connectedInstancePhone,
        recipientPhone: customerPhone,
        to: `${customerPhone}@c.us`,
        text: { message: 'Olá! Resposta ao cliente pelo celular.' },
      }),
    });

    const res = await processZapiWebhookRequest(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);

    const state = serverCRMStore.getState();

    // 1. Não deve haver nenhum contato criado com o número da própria corretora
    const brokerAsContact = state.contacts.find(c => c.phone?.includes(connectedInstancePhone) || c.id.includes(connectedInstancePhone));
    assert.strictEqual(brokerAsContact, undefined, 'Não deve criar contato para o próprio número da imobiliária');

    // 2. Não deve haver nenhuma conversa consigo mesmo
    const brokerConv = state.conversations.find(c => c.id.includes(connectedInstancePhone) || c.contactId.includes(connectedInstancePhone));
    assert.strictEqual(brokerConv, undefined, 'Não deve criar conversa para o próprio número da imobiliária');

    // 3. A conversa deve pertencer ao cliente destinatário
    const customerConv = state.conversations.find(c => c.id.includes(customerPhone) || c.contactId.includes(customerPhone));
    assert.ok(customerConv, 'Deve criar conversa para o cliente');

    // 4. A mensagem gravada deve estar na conversa do cliente com senderType USER
    const savedMsg = state.messages.find(m => m.id === 'msg-test-fromme-01');
    assert.ok(savedMsg, 'Deve salvar a mensagem enviada');
    assert.strictEqual(savedMsg?.conversationId, customerConv?.id);
    assert.strictEqual(savedMsg?.senderType, 'USER');
  });

  test('Webhook with fromMe: false must target sender customer', async () => {
    // Simula mensagem recebida de cliente
    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        messageId: 'msg-test-incoming-02',
        fromMe: false,
        senderPhone: customerPhone,
        senderName: 'Carlos Cliente Teste',
        recipientPhone: connectedInstancePhone,
        text: { message: 'Olá, gostaria de saber sobre um imóvel.' },
      }),
    });

    const res = await processZapiWebhookRequest(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);

    const state = serverCRMStore.getState();

    // O cliente deve ter sido criado
    const customer = state.contacts.find(c => c.phone?.includes(customerPhone));
    assert.ok(customer, 'Deve criar contato para o cliente remetente');
    assert.strictEqual(customer?.name, 'Carlos Cliente Teste');

    // A conversa deve ter sido criada e pendente para a equipe
    const conv = state.conversations.find(c => c.contactId === customer?.id);
    assert.ok(conv, 'Deve criar conversa para o contato');
    assert.strictEqual(conv?.status, 'PENDING_TEAM');
  });

  test('Reuses existing conversation ID when customer already has a chat in CRM', async () => {
    // Pré-registra uma conversa existente com ID customizado
    serverCRMStore.updateState({
      contacts: [{
        id: 'contact-existing-100',
        tenantId: 'tenant-amabile-barbarotti',
        name: 'Cliente Já Existente',
        phone: `+${customerPhone}`,
        source: 'WHATSAPP',
        temperature: 'HOT',
        aiPriorityScore: 90,
        tags: [],
        targetRegions: [],
        notesCount: 0,
        consentGiven: true,
        hasOptedOut: false,
        isPersonal: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      conversations: [{
        id: 'conv-custom-100',
        tenantId: 'tenant-amabile-barbarotti',
        contactId: 'contact-existing-100',
        status: 'PENDING_CLIENT',
        unreadCount: 0,
        lastMessagePreview: 'Olá anterior',
        lastMessageAt: new Date().toISOString(),
        slaBreached: false,
        isPersonal: false,
      }],
    });

    // Envia webhook com nova mensagem para este contato
    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        messageId: 'msg-test-reuse-03',
        fromMe: false,
        phone: customerPhone,
        text: { message: 'Mensagem de continuação na mesma conversa' },
      }),
    });

    await processZapiWebhookRequest(req);

    const state = serverCRMStore.getState();

    // Não deve criar uma conversa nova 'conv-zapi-xxx', deve manter conv-custom-100
    expectConvCustom: {
      const match = state.conversations.filter(c => c.contactId === 'contact-existing-100');
      assert.strictEqual(match.length, 1);
      assert.strictEqual(match[0].id, 'conv-custom-100');
    }

    // A mensagem deve estar atribuída a conv-custom-100
    const msg = state.messages.find(m => m.id === 'msg-test-reuse-03');
    assert.strictEqual(msg?.conversationId, 'conv-custom-100');
  });

  test('POST /api/v1/conversations/[id]/messages accepts requests with user headers without 401 Unauthorized', async () => {
    const { POST } = await import('../src/app/api/v1/conversations/[id]/messages/route');

    const req = new NextRequest('http://localhost:3000/api/v1/conversations/conv-custom-100/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant-amabile-barbarotti',
        'x-user-id': 'user-1',
        'x-user-email': 'admin@amabile.com',
      },
      body: JSON.stringify({
        content: 'Nota interna de teste enviada pela equipe',
        isInternalNote: true,
      }),
    });

    const res = await POST(req, { params: { id: 'conv-custom-100' } });
    const data = await res.json();

    assert.strictEqual(res.status, 200, 'Deve autorizar via headers de usuário sem 401');
    assert.strictEqual(data.isInternalNote, true);
    assert.strictEqual(data.conversationId, 'conv-custom-100');
  });
});
