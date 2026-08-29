import { expect, test } from './apoio.ts';

const PARAGRAFO = 'A Lady Morgana esteve na Floresta Negra antes do assassinato.';

/** Cria campanha e página pela UI e devolve a URL da página. */
async function abrirPaginaNova(page: import('@playwright/test').Page, nome: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();

  await page.getByPlaceholder('Nova página…').fill(nome);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  return page.url();
}

test('o que foi escrito sobrevive a um F5', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const url = await abrirPaginaNova(page, 'Lady Morgana');

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially(PARAGRAFO);

  // Autosave com debounce de 1,5 s. Esperar "Salvando…" sumir não serve: a barra
  // também está vazia enquanto se digita. O sinal de que o servidor gravou é "Salvo".
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto(url);
  await expect(page.locator('.ProseMirror')).toContainText(PARAGRAFO);
  // Veio do servidor, não do rascunho local.
  await expect(page.getByText('Rascunho local recuperado.', { exact: true })).toBeHidden();
});

test('sem rede, o texto volta do rascunho local — o risco R2', async ({ page, context, usuario }) => {
  expect(usuario).toBeTruthy();
  const url = await abrirPaginaNova(page, 'Capitão Roderick');

  const editor = page.locator('.ProseMirror');
  await editor.click();

  // A aba cai no meio da digitação: o salvamento não chega ao servidor.
  await context.setOffline(true);
  await editor.pressSequentially(PARAGRAFO);
  await expect(page.getByText('Não consegui salvar')).toBeVisible({ timeout: 15_000 });

  await context.setOffline(false);
  await page.goto(url);

  await expect(page.getByText('Rascunho local recuperado')).toBeVisible();
  await expect(page.locator('.ProseMirror')).toContainText(PARAGRAFO);
});
