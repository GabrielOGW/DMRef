import { expect, test } from './apoio.ts';

/** Cria campanha e página pela UI e devolve a URL da página. */
async function abrirPaginaNova(page: import('@playwright/test').Page, nome: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByPlaceholder('Sombras de Valoria').fill('Sombras de Valoria');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sombras de Valoria' })).toBeVisible();

  const campanha = page.url();
  await page.getByPlaceholder('Nova página…').fill(nome);
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
  return { pagina: page.url(), campanha };
}

const mencao = (page: import('@playwright/test').Page) =>
  page.locator('.ProseMirror span[data-type="mention"]');

test('digitar @ cria o NPC e a frase continua', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { pagina, campanha } = await abrirPaginaNova(page, 'Sessão 01');

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially('O grupo encontrou @Roderick');

  // Nada digitado ainda existe, então o popover oferece criar.
  await expect(page.getByText('Criar «Roderick» como…')).toBeVisible();
  await page.getByRole('button', { name: 'NPC', exact: true }).click();

  // Sem esperar carregamento: o nó já está no texto e a frase segue.
  await expect(mencao(page)).toHaveText('@Roderick');
  await editor.pressSequentially('na taverna.');
  await expect(editor).toContainText('na taverna.');

  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });

  // A entidade nasceu de verdade: aparece na campanha e a menção sobrevive ao F5.
  await page.goto(campanha);
  await expect(page.getByRole('link', { name: /Roderick/ })).toBeVisible();

  await page.goto(pagina);
  await expect(mencao(page)).toHaveText('@Roderick');
});

test('a menção guarda o id, não o nome', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { pagina } = await abrirPaginaNova(page, 'Sessão 02');

  const editor = page.locator('.ProseMirror');
  await editor.click();
  // Sem espaço: o gatilho fecha no primeiro espaço, como o exemplo do README
  // (`@Lady_Morgana`) já indicava.
  await editor.pressSequentially('@Lady_Morgana');
  await page.getByRole('button', { name: 'NPC', exact: true }).click();

  const id = await mencao(page).getAttribute('data-id');
  // UUIDv7 gerado no cliente — o nó entra com o id definitivo, sem id temporário.
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto(pagina);
  await expect(mencao(page)).toHaveAttribute('data-id', id!);
});

test('a segunda menção reaproveita a entidade em vez de criar outra', async ({ page, usuario }) => {
  expect(usuario).toBeTruthy();
  const { pagina, campanha } = await abrirPaginaNova(page, 'Sessão 03');

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially('@Morgana');
  await page.getByRole('button', { name: 'NPC', exact: true }).click();
  const id = await mencao(page).getAttribute('data-id');

  // Já no cache local, antes de qualquer recarga: a busca acha em vez de oferecer criar.
  await editor.pressSequentially('sumiu, e @Morg');
  await expect(page.getByRole('button', { name: /Morgana/ })).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(mencao(page)).toHaveCount(2);
  expect(await mencao(page).nth(1).getAttribute('data-id')).toBe(id);

  await expect(page.getByText('Salvo', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto(campanha);
  await expect(page.getByRole('link', { name: /Morgana/ })).toHaveCount(1);
  await page.goto(pagina);
  await expect(mencao(page)).toHaveCount(2);
});
