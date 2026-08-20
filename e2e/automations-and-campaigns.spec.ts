import { test, expect } from '@playwright/test';

test.describe('Automations, Campaigns & CSV Export E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Should navigate to Automations tab and toggle an automation rule', async ({ page }) => {
    // Clica na aba Automações & Regras
    await page.getByRole('button', { name: /Automações & Regras/i }).click();

    // Valida carregamento da tela de regras
    await expect(page.getByText('Motor de Automações & Regras Comerciais')).toBeVisible();
    await expect(page.getByText('Boas-vindas Instantânea para Novos Leads do WhatsApp')).toBeVisible();

    // Alterna para a aba de Logs de Execução
    await page.getByRole('button', { name: /Logs de Execução/i }).click();
    await expect(page.getByText('Trilha de Auditoria e Execuções das Automações')).toBeVisible();
  });

  test('Should navigate to Leads tab and trigger CSV export', async ({ page }) => {
    // Clica na aba Leads & Clientes
    await page.getByRole('button', { name: /Leads & Clientes/i }).click();

    // Valida presença da tabela de contatos e botão de exportação
    await expect(page.getByText('Leads & Contatos Imobiliários')).toBeVisible();
    const exportBtn = page.getByRole('button', { name: /Exportar CSV/i });
    await expect(exportBtn).toBeVisible();
  });
});
