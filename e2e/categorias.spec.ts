import type { Page } from '@playwright/test';

import { expect, test } from './apoio.ts';

async function novaCampanha(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();
  return page.url();
}

const barra = (page: Page) => page.getByRole('complementary');

test('as categorias padrão aparecem mesmo vazias, de qualquer página', async ({
  page,
  usuario,
}) => {
  expect(usuario).toBeTruthy();
  const campanha = await novaCampanha(page);

  for (const nome of ['Sessões', 'Personagens jogáveis', 'NPCs', 'Locais', 'Eventos', 'Notas']) {
    await expect(barra(page).getByRole('link', { name: new RegExp(nome) })).toBeVisible();
  }

  // Também dentro de uma página, não só na porta de entrada.
  await page.getByRole('button', { name: 'Nova sessão' }).click();
  await expect(page.getByRole('heading', { name: 'Sessão 01' })).toBeVisible();
  await expect(barra(page).getByRole('link', { name: /Locais/ })).toBeVisible();

  expect(campanha).toContain('/c/');
});

test('a categoria conta, lista, e a página nasce já do tipo certo', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const campanha = await novaCampanha(page);

  await barra(page).getByRole('link', { name: /Locais/ }).click();
  await expect(page.getByRole('heading', { name: 'Locais' })).toBeVisible();

  await page.getByPlaceholder(/novo\(a\) local/i).fill('Floresta Negra');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  // Criada de dentro de Locais, nasce Local — sem ninguém escolher tipo nenhum.
  await expect(page.locator('h1 + p')).toHaveText('Local');

  await page.goto(campanha);
  await expect(barra(page).getByRole('link', { name: 'Locais 1' })).toBeVisible();
});

test('dá para criar categoria nova, e as padrão não têm como sumir', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  await novaCampanha(page);

  await barra(page).getByPlaceholder('Nova categoria…').fill('Divindades');
  await barra(page).getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByRole('heading', { name: 'Divindades' })).toBeVisible();
  await expect(barra(page).getByRole('link', { name: 'Divindades' })).toBeVisible();

  // As padrão continuam lá, e não existe caminho de exclusão para nenhuma categoria.
  await expect(barra(page).getByRole('link', { name: /Sessões/ })).toBeVisible();
  await expect(barra(page).getByRole('button', { name: /Excluir|Apagar|Remover/ })).toHaveCount(0);

  // Nome repetido não passa: escureceria um tipo global e apareceria duas vezes.
  await barra(page).getByPlaceholder('Nova categoria…').fill('Locais');
  await barra(page).getByRole('button', { name: 'Criar categoria' }).click();
  await expect(barra(page).getByRole('link', { name: /^Locais/ })).toHaveCount(1);
});
