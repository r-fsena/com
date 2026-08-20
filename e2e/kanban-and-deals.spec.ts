import { test, expect } from '@playwright/test';

test.describe('Kanban Funnel & Real Estate Deals E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Should navigate to Kanban board and display funnel stages and metrics', async ({ page }) => {
    // Clica na aba Funil & Negócios
    await page.getByRole('button', { name: /Funil & Negócios/i }).click();

    // Valida títulos do Kanban
    await expect(page.getByText('Vendas Residencial Alto Padrão')).toBeVisible();
    await expect(page.getByText('Valor Total no Funil')).toBeVisible();
    await expect(page.getByText('1. Novo Lead WhatsApp')).toBeVisible();
    await expect(page.getByText('5. Visita Agendada')).toBeVisible();
    await expect(page.getByText('8. Contrato Fechado')).toBeVisible();
  });

  test('Should open new lead modal and create a qualified real estate deal', async ({ page }) => {
    // Abre modal de Novo Lead
    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    await expect(page.getByText('Novo Lead & Oportunidade')).toBeVisible();

    // Preenche dados cadastrais
    await page.getByPlaceholder(/Ex: Dra\. Mariana Vasconcelos/i).fill('Engenheiro Bruno Fagundes');
    await page.getByPlaceholder(/\+55 11 99999-8888/i).fill('+55 11 99111-2233');

    // Submete cadastro
    await page.getByRole('button', { name: /Cadastrar Lead & Criar Negócio/i }).click();

    // Navega ao Kanban e verifica o novo negócio
    await page.getByRole('button', { name: /Funil & Negócios/i }).click();
    await expect(page.getByText('Engenheiro Bruno Fagundes').first()).toBeVisible();
  });
});
