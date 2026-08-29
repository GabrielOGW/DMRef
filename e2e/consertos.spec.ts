import type { Page } from '@playwright/test';

import { expect, test } from './apoio.ts';

async function campanhaComSessao(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  // Esperar o redirecionamento terminar antes de ler a URL, senão pega a anterior.
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();
  const campanha = page.url();

  await page.getByRole('button', { name: 'Nova sessão' }).click();
  await expect(page.getByRole('heading', { name: 'Sessão 01' })).toBeVisible();
  return { campanha, sessao: page.url() };
}

const editor = (page: Page) => page.locator('.ProseMirror');
const mencao = (page: Page) => page.locator('.ProseMirror span[data-type="mention"]');

async function abrirGaveta(page: Page) {
  await page.getByText('Renomear, trocar o tipo ou arquivar').click();
}

test('renomear conserta o rótulo nos textos antigos', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { campanha, sessao } = await campanhaComSessao(page);

  await editor(page).pressSequentially('O grupo encontrou @Morgana');
  await page.getByRole('button', { name: 'NPC', exact: true }).click();
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(mencao(page)).toHaveText('@Morgana');

  // Na página dela, renomeia.
  await page.goto(campanha);
  await page.getByRole('link', { name: /Morgana/ }).click();
  await expect(page.getByRole('heading', { name: 'Morgana' })).toBeVisible();
  const url = page.url();
  await abrirGaveta(page);
  await page.getByLabel('Nome').fill('Lady Morgana');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Lady Morgana' })).toBeVisible();

  // O endereço não muda — renomear não pode quebrar link (ARQUITETURA.md §6.4).
  expect(page.url()).toBe(url);

  // E o texto antigo passa a mostrar o nome novo, sem ter sido reescrito.
  await page.goto(sessao);
  await expect(mencao(page)).toHaveText('@Lady Morgana');
});

test('trocar o tipo é uma coluna, não uma migração', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { campanha } = await campanhaComSessao(page);

  await page.goto(campanha);
  await page.getByPlaceholder('Nova página…').fill('Floresta Negra');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  // A linha logo abaixo do título é o tipo. `getByText` pegaria também o <option>.
  const tipo = page.locator('h1 + p');
  await expect(tipo).toHaveText('Nota');

  await abrirGaveta(page);
  await page.getByLabel('Tipo').selectOption('local');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(tipo).toHaveText('Local');
});

test('arquivar some das listas sem apagar, e dá para desarquivar', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { campanha } = await campanhaComSessao(page);

  await page.goto(campanha);
  await page.getByPlaceholder('Nova página…').fill('Pagina Errada');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pagina Errada' })).toBeVisible();
  const url = page.url();

  await abrirGaveta(page);
  await page.getByRole('button', { name: 'Arquivar' }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pagina Errada/ })).toBeHidden();

  // Também sai do Ctrl+K.
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('errada');
  await expect(page.getByRole('dialog').getByText('Nada com esse nome')).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press('Escape');

  // Mas não foi apagada: continua na URL, e de lá se desarquiva.
  await page.goto(url);
  await expect(page.getByText('arquivada')).toBeVisible();
  await abrirGaveta(page);
  await page.getByRole('button', { name: 'Desarquivar' }).click();
  await page.goto(campanha);
  await expect(page.getByRole('link', { name: /Pagina Errada/ })).toBeVisible();
});
