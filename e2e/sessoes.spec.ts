import type { Page } from '@playwright/test';

import { expect, test } from './apoio.ts';

async function criarCampanha(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();
  return page.url();
}

async function abrirNovaSessao(page: Page, campanha: string) {
  await page.goto(campanha);
  await page.getByRole('button', { name: 'Nova sessão' }).click();
  await expect(page.locator('.ProseMirror')).toBeVisible();
  return page.url();
}

async function mencionar(page: Page, nome: string, { criar }: { criar: boolean }) {
  const editor = page.locator('.ProseMirror');
  // O corpo já vem em foco; não precisa clicar para começar a escrever.
  await editor.pressSequentially(`Aqui, @${nome}`);
  if (criar) {
    await page.getByRole('button', { name: 'NPC', exact: true }).click();
  } else {
    await expect(page.getByRole('button', { name: new RegExp(nome) })).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });
}

test('a sessão nasce numerada e com o corpo em foco', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await criarCampanha(page);

  await abrirNovaSessao(page, campanha);
  await expect(page.getByRole('heading', { name: 'Sessão 01' })).toBeVisible();
  // Sem clicar em nada: dá para escrever direto.
  await page.keyboard.type('A viagem começou.');
  await expect(page.locator('.ProseMirror')).toContainText('A viagem começou.');

  await abrirNovaSessao(page, campanha);
  await expect(page.getByRole('heading', { name: 'Sessão 02' })).toBeVisible();

  await page.goto(campanha);
  await expect(page.getByRole('link', { name: 'Sessão 01' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sessão 02' })).toBeVisible();
});

test('o histórico sai na ordem da ficção, não na de edição', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await criarCampanha(page);

  // Cinco sessões, e a Morgana mencionada na 05, na 01 e na 03 — nessa ordem.
  const urls: string[] = [];
  for (let i = 0; i < 5; i++) urls.push(await abrirNovaSessao(page, campanha));

  await page.goto(urls[4]);
  await mencionar(page, 'Morgana', { criar: true });
  await page.goto(urls[0]);
  await mencionar(page, 'Morgana', { criar: false });
  await page.goto(urls[2]);
  await mencionar(page, 'Morgana', { criar: false });

  await page.goto(campanha);
  await page.getByRole('link', { name: /Morgana/ }).click();
  await expect(page.getByRole('heading', { name: 'Morgana' })).toBeVisible();

  const historico = page.locator('section div', {
    has: page.getByRole('heading', { name: 'Histórico' }),
  });
  await expect(historico.getByRole('link')).toHaveText(['Sessão 01', 'Sessão 03', 'Sessão 05']);
});
