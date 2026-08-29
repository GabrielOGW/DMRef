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

async function criarPagina(page: Page, campanha: string, nome: string) {
  await page.goto(campanha);
  await page.getByPlaceholder('Nova página…').fill(nome);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  return page.url();
}

/**
 * Escreve `antes @Nome depois` e espera o servidor confirmar. A menção tem que ser
 * escolhida antes de continuar a frase: o gatilho fecha no primeiro espaço.
 */
async function escrever(
  page: Page,
  antes: string,
  nome: string,
  depois: string,
  { criar = true } = {},
) {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially(`${antes}@${nome}`);
  if (criar) {
    // Última seção do popover: "Criar «X» como…".
    await page.getByRole('button', { name: 'NPC', exact: true }).click();
  } else {
    // Primeira linha já vem selecionada: a entidade que existe.
    await expect(page.getByRole('button', { name: new RegExp(nome) })).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await editor.pressSequentially(depois);
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });
}

const ondeAparece = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Onde aparece' }) });

test('mencionar em dois textos põe os dois na página da entidade', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await criarCampanha(page);

  const sessao1 = await criarPagina(page, campanha, 'Sessão 01');
  await escrever(page, 'O grupo encontrou ', 'Morgana', 'na taverna.');
  const morgana = page.locator('.ProseMirror span[data-type="mention"]');
  await expect(morgana).toHaveText('@Morgana');

  const sessao2 = await criarPagina(page, campanha, 'Sessão 02');
  // Numa página nova, com o cache recarregado do servidor: tem que reaproveitar
  // a entidade, não criar uma segunda Morgana.
  await escrever(page, 'De novo ', 'Morgana', 'agora na floresta.', { criar: false });

  // A página da Morgana foi criada pela menção; chega-se nela pela lista da campanha.
  await page.goto(campanha);
  await expect(page.getByRole('link', { name: /Morgana/ })).toHaveCount(1);
  await page.getByRole('link', { name: /Morgana/ }).click();
  await expect(page.getByRole('heading', { name: 'Morgana' })).toBeVisible();

  const secao = ondeAparece(page);
  await expect(secao.getByRole('link', { name: 'Sessão 01' })).toBeVisible();
  await expect(secao.getByRole('link', { name: 'Sessão 02' })).toBeVisible();
  // O contexto vem congelado da derivação, com o texto ao redor.
  await expect(secao).toContainText('O grupo encontrou @Morgana na taverna.');
  await expect(secao).toContainText('De novo @Morgana agora na floresta.');

  expect(sessao1).not.toBe(sessao2);
});

test('apagar a menção do texto tira a linha no salvamento seguinte', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await criarCampanha(page);

  await criarPagina(page, campanha, 'Sessão 01');
  await escrever(page, 'Vi ', 'Roderick', 'ontem.');

  await page.goto(campanha);
  await page.getByRole('link', { name: /Roderick/ }).click();
  await expect(ondeAparece(page).getByRole('link', { name: 'Sessão 01' })).toBeVisible();

  // Volta na sessão e apaga tudo.
  await page.goto(campanha);
  await page.getByRole('link', { name: /Sessão 01/ }).click();
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto(campanha);
  await page.getByRole('link', { name: /Roderick/ }).click();
  await expect(ondeAparece(page).getByRole('link', { name: 'Sessão 01' })).toBeHidden();
  await expect(ondeAparece(page)).toContainText('Ninguém mencionou esta página ainda');
});
