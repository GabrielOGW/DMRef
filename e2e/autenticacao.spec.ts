import { test as semSessao } from '@playwright/test';

import { expect, test } from './apoio.ts';

semSessao.describe('sem sessão', () => {
  semSessao('a raiz manda para o login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole('button', { name: 'Entrar com GitHub' })).toBeVisible();
  });

  semSessao('campanha de terceiro também manda para o login', async ({ page }) => {
    await page.goto('/c/qualquer-coisa');
    await expect(page).toHaveURL(/\/entrar$/);
  });
});

test('com sessão, a raiz é a lista de campanhas', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Campanhas' })).toBeVisible();
  await expect(page.getByText('Nenhuma campanha ainda')).toBeVisible();
});
