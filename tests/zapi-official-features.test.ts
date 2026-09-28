import { test, describe } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { processZapiWebhookRequest } from '../src/lib/zapi-webhook-handler';
import { serverCRMStore } from '../src/lib/server-crm-store';
import { ZApiClient } from '../src/lib/zapi-client';

describe('Z-API Official Enhancements Tests (Items 1-6)', () => {
  const testPhone = '5548988771122';
  const testMessageId = 'test-msg-status-123';

  test('Item 1 & 5 & 6: ZApiClient has official endpoints implemented', () => {
    const client = new ZApiClient({
      instanceId: 'TEST_ID',
      instanceToken: 'TEST_TOKEN',
      securityToken: 'TEST_SEC',
    });

    assert.strictEqual(typeof client.updateEveryWebhooks, 'function', 'updateEveryWebhooks exists');
    assert.strictEqual(typeof client.phoneExists, 'function', 'phoneExists exists');
    assert.strictEqual(typeof client.getProfilePicture, 'function', 'getProfilePicture exists');
    assert.strictEqual(typeof client.getTags, 'function', 'getTags exists');
    assert.strictEqual(typeof client.addTagToChat, 'function', 'addTagToChat exists');
    assert.strictEqual(typeof client.removeTagFromChat, 'function', 'removeTagFromChat exists');
    assert.strictEqual(typeof client.modifyChat, 'function', 'modifyChat exists');
    assert.strictEqual(typeof client.getChats, 'function', 'getChats exists');
    assert.strictEqual(typeof client.getChatMetadata, 'function', 'getChatMetadata exists');
    assert.strictEqual(typeof client.getChatMessages, 'function', 'getChatMessages exists');
  });

  test('Item 3: MessageStatusCallback webhook updates message status to READ', async () => {
    // Insere uma mensagem de teste no serverCRMStore
    serverCRMStore.updateState({
      messages: [{
        id: testMessageId,
        externalId: testMessageId,
        tenantId: 'tenant-test',
        conversationId: `conv-zapi-${testPhone}`,
        senderType: 'USER',
        content: 'Proposta do Imóvel enviada',
        status: 'DELIVERED',
        isInternalNote: false,
        timestamp: new Date().toISOString(),
      }],
    });

    // Envia webhook de callback de leitura (Oficial Z-API)
    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        type: 'MessageStatusCallback',
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        status: 'READ',
        ids: [testMessageId],
        phone: testPhone,
      }),
    });

    const res = await processZapiWebhookRequest(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.status, 'READ');
    assert.strictEqual(data.updatedCount, 1);

    const state = serverCRMStore.getState();
    const updated = state.messages.find(m => m.id === testMessageId);
    assert.strictEqual(updated?.status, 'READ', 'Mensagem deve estar com status READ (duplo check azul)');
  });

  test('Item 4: PresenceChatCallback webhook registers COMPOSING status', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        type: 'PresenceChatCallback',
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        phone: testPhone,
        status: 'COMPOSING',
      }),
    });

    const res = await processZapiWebhookRequest(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.status, 'COMPOSING');

    const presence = serverCRMStore.getPresence(testPhone);
    assert.strictEqual(presence, 'COMPOSING', 'Presença do contato deve ser COMPOSING (digitando...)');
  });

  test('Item 2: markConversationRead clears unread count', () => {
    serverCRMStore.updateState({
      conversations: [{
        id: `conv-zapi-${testPhone}`,
        tenantId: 'tenant-test',
        contactId: `contact-zapi-${testPhone}`,
        unreadCount: 3,
        status: 'PENDING_TEAM',
        lastMessagePreview: 'Olá!',
        lastMessageAt: new Date().toISOString(),
      }],
    });

    const modified = serverCRMStore.markConversationRead(`conv-zapi-${testPhone}`);
    assert.strictEqual(modified, true);

    const conv = serverCRMStore.getState().conversations.find(c => c.id === `conv-zapi-${testPhone}`);
    assert.strictEqual(conv?.unreadCount, 0);
    assert.strictEqual(conv?.status, 'OPEN');
  });

  test('Outgoing message sent from mobile WhatsApp (fromMe = true) is synced to CRM', async () => {
    const clientPhone = '5548988990011';
    const mobileSentMessageId = 'msg-mobile-sent-999';

    const req = new NextRequest('http://localhost:3000/api/v1/webhooks/zapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-token': 'Fc78d61c833db4b50864816b70766aee8S',
      },
      body: JSON.stringify({
        type: 'ReceivedCallback',
        instanceId: '3F8144490C66805B4E3FD64A35E2F2DC',
        messageId: mobileSentMessageId,
        connectedPhone: '554899797603',
        phone: clientPhone,
        fromMe: true,
        chatName: 'Cliente VIP',
        senderName: 'Amábile Barbarotti',
        text: {
          message: 'Olá, acabei de te mandar a proposta pelo celular!',
        },
      }),
    });

    const res = await processZapiWebhookRequest(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.fromMe, true);
    assert.strictEqual(data.phone, clientPhone);

    const state = serverCRMStore.getState();
    const saved = state.messages.find(m => m.id === mobileSentMessageId);
    assert.ok(saved, 'Mensagem enviada do celular deve estar salva no serverCRMStore');
    assert.strictEqual(saved?.senderType, 'USER', 'Remetente de mensagem fromMe deve ser USER');
    assert.strictEqual(saved?.content, 'Olá, acabei de te mandar a proposta pelo celular!');

    const conv = state.conversations.find(c => c.id === `conv-zapi-${clientPhone}`);
    assert.ok(conv, 'Conversa deve existir para o cliente destinatário');
    assert.strictEqual(conv?.status, 'PENDING_CLIENT', 'Status da conversa deve ser PENDING_CLIENT após envio do corretor');
  });
});

