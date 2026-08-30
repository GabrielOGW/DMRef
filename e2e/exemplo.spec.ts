import type { Page } from '@playwright/test';

import { expect, test } from './apoio.ts';

/**
 * O tutorial é conteúdo, então o que quebra nele quebra em silêncio: uma menção
 * apontando para id de fora some na gravação (`salvarDocumento` descarta órfã) e
 * a campanha de exemplo abriria sem o backlink que ela promete ensinar. O teste
 * de unidade cobre o documento; este cobre o caminho inteiro até a tela.
 */

const ABRIR = 'Abrir a campanha de exemplo';
const ondeAparece = (page: Page) => page.locator('main > section');

test('a campanha de exemplo abre no tutorial, com os backlinks já derivados', async ({
  page,
  usuario,
}) => {
  expect(usuario).toBeTruthy();

  await page.goto('/');
  await page.getByRole('button', { name: ABRIR }).click();

  // Cai na página de entrada, não no índice da campanha.
  await expect(page.getByRole('heading', { name: 'Comece aqui', level: 1 })).toBeVisible();
  await expect(page.locator('.ProseMirror')).toContainText('Você escreve a sessão');
  // As menções chegaram com rótulo — `@null` foi um defeito real do PR 4.
  await expect(page.locator('.ProseMirror span[data-type="mention"]').first()).toContainText(
    '@Sessão 01',
  );

  // A barra lateral é o caminho que o próprio texto ensina.
  await page.getByRole('link', { name: /NPCs/ }).click();
  await page.getByRole('link', { name: 'Lady Morgana' }).click();
  await expect(page.getByRole('heading', { name: 'Lady Morgana', level: 1 })).toBeVisible();

  // O que o tutorial promete: uma linha que ninguém digitou, sob "Histórico",
  // porque a origem é uma sessão numerada.
  const secao = ondeAparece(page);
  await expect(secao.getByRole('heading', { name: 'Histórico' })).toBeVisible();
  await expect(secao.getByRole('link', { name: 'Sessão 01' })).toHaveCount(1);
  await expect(secao).toContainText('dormiu aqui há três noites');

  // A outra metade da lição da página da Morgana: menção vinda de fora de uma
  // sessão cai em "Aparece em", não no "Histórico".
  await expect(secao.getByRole('heading', { name: 'Aparece em' })).toBeVisible();
  await expect(secao.getByRole('link', { name: 'Comece aqui' })).toHaveCount(1);
});

test('abrir de novo reabre a mesma campanha, sem duplicar', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();

  await page.goto('/');
  await page.getByRole('button', { name: ABRIR }).click();
  await expect(page.getByRole('heading', { name: 'Comece aqui', level: 1 })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: ABRIR }).click();
  await expect(page.getByRole('heading', { name: 'Comece aqui', level: 1 })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Comece aqui' })).toHaveCount(1);
});
