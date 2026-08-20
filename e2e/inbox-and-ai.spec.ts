import { test, expect } from '@playwright/test';

test.describe('WhatsApp Inbox, Z-API Webhook & IA Copilot E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Should render the 3-column WhatsApp Inbox and display active conversation', async ({ page }) => {
    // Valida Header e Sidebar
    await expect(page.getByText('Inbox WhatsApp')).toBeVisible();
    await expect(page.getByText('Z-API Gateway')).toBeVisible();

    // Seleciona uma conversa (Dr. Roberto Silveira)
    const contactCard = page.getByRole('button', { name: /Dr\. Roberto Silveira/i }).first();
    await expect(contactCard).toBeVisible();
    await contactCard.click();

    // Valida que o perfil 360 e o histórico de mensagens carregaram
    await expect(page.getByText('Perfil 360º do Lead')).toBeVisible();
    await expect(page.getByText('Qualificação Financeira')).toBeVisible();
  });

  test('Should simulate incoming Z-API webhook and trigger AI Copilot', async ({ page }) => {
    // Abre o simulador Z-API
    const simButton = page.getByRole('button', { name: /Simular Entrada Z-API/i }).first();
    await expect(simButton).toBeVisible();
    await simButton.click();

    // Seleciona o preset da Médica Alta Renda
    await page.getByRole('button', { name: /Médica \(Alta Renda/i }).click();

    // Submete a simulação do webhook
    await page.getByRole('button', { name: /Simular Recebimento/i }).click();

    // Verifica que o modal fechou e o contato apareceu na lista
    await expect(page.getByText('Dra. Beatriz Albuquerque')).toBeVisible({ timeout: 5000 });
  });

  test('Should allow sending a text message and writing an internal private note', async ({ page }) => {
    // Seleciona a primeira conversa
    await page.getByRole('button', { name: /Dr\. Roberto Silveira/i }).first().click();

    // Digita e envia uma mensagem normal
    const inputArea = page.getByPlaceholder(/Digite sua mensagem para o WhatsApp/i);
    await inputArea.fill('Olá Dr. Roberto, mensagem de teste automatizado Playwright.');
    await page.keyboard.press('Enter');

    // Verifica que a mensagem foi inserida no chat
    await expect(page.getByText('Olá Dr. Roberto, mensagem de teste automatizado Playwright.')).toBeVisible();

    // Alterna para Modo Nota Interna
    const noteToggle = page.getByRole('button', { name: /WhatsApp Cliente/i });
    await noteToggle.click();
    await expect(page.getByRole('button', { name: /Modo Nota Interna/i })).toBeVisible();

    // Digita e envia a nota interna
    const noteInput = page.getByPlaceholder(/Escreva uma nota interna sobre este lead/i);
    await noteInput.fill('Nota privada de teste: cliente aprovou proposta.');
    await page.keyboard.press('Enter');

    // Valida o card amarelo de nota interna
    await expect(page.getByText('Nota Interna da Equipe (Invisível para o cliente)')).toBeVisible();
    await expect(page.getByText('Nota privada de teste: cliente aprovou proposta.')).toBeVisible();
  });
});
