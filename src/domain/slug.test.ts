import { describe, expect, it } from 'vitest';

import { inserirComSlugUnico, slugify } from './slug.ts';

describe('slugify', () => {
  it('remove acentos e normaliza separadores', () => {
    expect(slugify('Sombras de Valória')).toBe('sombras-de-valoria');
    expect(slugify('  A Queda   do Rei Alaric! ')).toBe('a-queda-do-rei-alaric');
  });

  it('não deixa hífen nas bordas, nem depois do corte', () => {
    expect(slugify('--Ecos--')).toBe('ecos');
    expect(slugify(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59));
  });

  it('degrada para string vazia quando não sobra nada', () => {
    expect(slugify('日本語')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('inserirComSlugUnico', () => {
  it('usa o slug base quando está livre', async () => {
    const tentados: string[] = [];
    const linha = await inserirComSlugUnico('Lady Morgana', async (slug) => {
      tentados.push(slug);
      return { slug };
    });
    expect(linha).toEqual({ slug: 'lady-morgana' });
    expect(tentados).toEqual(['lady-morgana']);
  });

  it('numera a partir de 2 enquanto o índice recusar', async () => {
    const ocupados = new Set(['nota', 'nota-2']);
    const linha = await inserirComSlugUnico('Nota', async (slug) =>
      ocupados.has(slug) ? undefined : { slug },
    );
    expect(linha).toEqual({ slug: 'nota-3' });
  });

  it('cai num nome de reserva quando não sobra slug nenhum', async () => {
    const linha = await inserirComSlugUnico('日本語', async (slug) => ({ slug }));
    expect(linha).toEqual({ slug: 'sem-nome' });
  });

  it('desiste depois de cinco tentativas', async () => {
    await expect(inserirComSlugUnico('Nota', async () => undefined)).rejects.toThrow('nota');
  });
});
