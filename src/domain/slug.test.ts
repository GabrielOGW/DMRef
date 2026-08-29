import { describe, expect, it } from 'vitest';

import { slugify } from './slug.ts';

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
