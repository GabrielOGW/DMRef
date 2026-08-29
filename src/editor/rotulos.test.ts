import { describe, expect, it } from 'vitest';

import type { TiptapDoc } from '@/db/schema';

import { revalidarRotulos } from './rotulos.ts';

const mencao = (id: string, label: string) => ({ type: 'mention', attrs: { id, label } });
const p = (...filhos: unknown[]) => ({ type: 'paragraph', content: filhos });
const doc = (...filhos: unknown[]) => ({ type: 'doc', content: filhos }) as TiptapDoc;

const nomes = new Map([['m1', 'Lady Morgana']]);

describe('revalidarRotulos', () => {
  it('troca o rótulo velho pelo nome atual da entidade', () => {
    const revisado = revalidarRotulos(doc(p(mencao('m1', 'Morgana'))), nomes);
    expect(revisado).toEqual(doc(p(mencao('m1', 'Lady Morgana'))));
  });

  it('alcança menção aninhada em lista', () => {
    const dentro = doc({
      type: 'bulletList',
      content: [{ type: 'listItem', content: [p(mencao('m1', 'Morgana'))] }],
    });
    const revisado = revalidarRotulos(dentro, nomes) as typeof dentro;
    const item = (revisado.content![0] as { content: { content: { content: unknown[] }[] }[] })
      .content[0].content[0];
    expect(item).toEqual({ content: [mencao('m1', 'Lady Morgana')], type: 'paragraph' });
  });

  it('devolve o mesmo objeto quando nada mudou — sem troca de referência à toa', () => {
    const igual = doc(p(mencao('m1', 'Lady Morgana')));
    expect(revalidarRotulos(igual, nomes)).toBe(igual);

    const semMencao = doc(p({ type: 'text', text: 'nada aqui' }));
    expect(revalidarRotulos(semMencao, nomes)).toBe(semMencao);
  });

  it('deixa quieta a menção de entidade que não está no mapa — arquivada, por exemplo', () => {
    const orfa = doc(p(mencao('sumida', 'Alguém')));
    expect(revalidarRotulos(orfa, nomes)).toBe(orfa);
  });

  it('aguenta documento nulo e nó sem id', () => {
    expect(revalidarRotulos(null, nomes)).toBeNull();
    const semId = doc(p({ type: 'mention', attrs: { label: 'Fantasma' } }));
    expect(revalidarRotulos(semId, nomes)).toBe(semId);
  });
});
