import type { Page } from '@playwright/test';

import { expect, test } from './apoio.ts';

async function prepararCampanha(page: Page, nomes: string[]) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();
  const campanha = page.url();

  for (const nome of nomes) {
    await page.goto(campanha);
    await page.getByPlaceholder('Nova página…').fill(nome);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  }
  return campanha;
}

const paleta = (page: Page) => page.getByRole('dialog');

test('Ctrl+K acha pelo pedaço do meio do nome, de qualquer página', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await prepararCampanha(page, [
    'Lady Morgana',
    'Capitão Roderick',
    'Ordem das Sombras',
  ]);

  // De dentro de uma página, não da lista da campanha.
  await page.goto(campanha);
  await page.getByRole('link', { name: /Ordem das Sombras/ }).click();
  await expect(page.getByRole('heading', { name: 'Ordem das Sombras' })).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(paleta(page)).toBeVisible();

  // "morg" é o caso que o operador % do pg_trgm não acha (ARQUITETURA.md §3.6).
  // A folga do timeout é da primeira compilação de /api/busca no `next dev`, não
  // da consulta: o trigram responde em milissegundos.
  await page.keyboard.type('morg');
  await expect(paleta(page).getByText('Lady Morgana')).toBeVisible({ timeout: 20_000 });

  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Lady Morgana' })).toBeVisible();
  await expect(page).toHaveURL(/\/e\/lady-morgana$/);
});

test('"rod" acha Capitão Roderick, e o que não existe não inventa', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  await prepararCampanha(page, ['Lady Morgana', 'Capitão Roderick']);

  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('rod');
  await expect(paleta(page).getByText('Capitão Roderick')).toBeVisible({ timeout: 20_000 });
  await expect(paleta(page).getByText('Lady Morgana')).toBeHidden();

  // Apagar a busca não pode deixar o resultado anterior na tela.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  await expect(paleta(page).getByText('Capitão Roderick')).toBeHidden();
  await expect(paleta(page).getByText('Digite para buscar')).toBeVisible();

  await page.keyboard.type('grifo alado');
  await expect(paleta(page).getByText('Nada com esse nome')).toBeVisible({ timeout: 20_000 });
});
