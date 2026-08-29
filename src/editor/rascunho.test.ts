import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TiptapDoc } from '@/db/schema';

import { guardarRascunho, lerRascunho, limparRascunho } from './rascunho.ts';

const doc: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

function localStorageFalso() {
  const mapa = new Map<string, string>();
  return {
    getItem: (k: string) => mapa.get(k) ?? null,
    setItem: (k: string, v: string) => void mapa.set(k, v),
    removeItem: (k: string) => void mapa.delete(k),
    clear: () => mapa.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageFalso(),
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('rascunho', () => {
  it('devolve o que foi guardado quando a versão de origem bate', () => {
    guardarRascunho('e1', doc, '2026-08-29T00:00:00.000Z');
    expect(lerRascunho('e1', '2026-08-29T00:00:00.000Z')).toEqual(doc);
  });

  it('descarta rascunho nascido de outra versão — o servidor mudou por baixo', () => {
    guardarRascunho('e1', doc, '2026-08-29T00:00:00.000Z');
    expect(lerRascunho('e1', '2026-08-30T00:00:00.000Z')).toBeNull();
  });

  it('trata documento nunca salvo (base nula) como versão própria', () => {
    guardarRascunho('e1', doc, null);
    expect(lerRascunho('e1', null)).toEqual(doc);
    expect(lerRascunho('e1', '2026-08-29T00:00:00.000Z')).toBeNull();
  });

  it('não estoura com lixo no storage nem com chave ausente', () => {
    globalThis.localStorage.setItem('grimorio:rascunho:e1', '{isso não é json');
    expect(lerRascunho('e1', null)).toBeNull();
    expect(lerRascunho('inexistente', null)).toBeNull();
  });

  it('limpar apaga', () => {
    guardarRascunho('e1', doc, null);
    limparRascunho('e1');
    expect(lerRascunho('e1', null)).toBeNull();
  });

  it('sobrevive à ausência de localStorage', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(() => guardarRascunho('e1', doc, null)).not.toThrow();
    expect(lerRascunho('e1', null)).toBeNull();
  });
});
