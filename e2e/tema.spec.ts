import { test as base } from '@playwright/test';

import { expect, test } from './apoio.ts';

/**
 * Luminosidade 0–255 do que o navegador realmente pinta. Passa por um canvas
 * porque `getComputedStyle` devolve os tokens em `lab()`/`oklch()`, e comparar
 * string de espaço de cor é mais frágil do que medir o pixel.
 */
async function brilho(page: import('@playwright/test').Page, seletor: string, prop: 'cor' | 'fundo') {
  return page.evaluate(
    ([sel, qual]) => {
      const estilo = getComputedStyle(document.querySelector(sel as string)!);
      const contexto = document.createElement('canvas').getContext('2d')!;
      contexto.fillStyle = qual === 'fundo' ? estilo.backgroundColor : estilo.color;
      contexto.fillRect(0, 0, 1, 1);
      const [r, g, b] = contexto.getImageData(0, 0, 1, 1).data;
      return (r + g + b) / 3;
    },
    [seletor, prop] as const,
  );
}

base.describe('claro', () => {
  base.use({ colorScheme: 'light' });
  base('segue o sistema em claro', async ({ page }) => {
    await page.goto('/entrar');
    expect(await brilho(page, 'body', 'fundo')).toBeGreaterThan(230);
  });
});

test.describe('escuro', () => {
  test.use({ colorScheme: 'dark' });

  test('segue o sistema em escuro, sem alternador nem JS', async ({ page, usuario }) => {
    expect(usuario).toBeTruthy();
    await page.goto('/');
    // Escuro de verdade, não só "um pouco mais cinza".
    expect(await brilho(page, 'body', 'fundo')).toBeLessThan(60);
    // E o texto claro por cima, senão o tema está pela metade.
    expect(await brilho(page, 'h1', 'cor')).toBeGreaterThan(200);
  });

  test('o campo nativo do formulário também escurece', async ({ page, usuario }) => {
    expect(usuario).toBeTruthy();
    await page.goto('/entrar');
    // color-scheme é o que faz o navegador pintar select, scrollbar e caret.
    const esquema = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(esquema).toContain('dark');
  });
});
