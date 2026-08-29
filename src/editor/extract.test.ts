import { getSchema } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Node } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import type { TiptapDoc } from '@/db/schema';

import { extrairMencoes } from './extract.ts';
import { criarExtensaoDeMencao } from './mention.ts';

const texto = (t: string) => ({ type: 'text', text: t });
const mencao = (id: string, label: string) => ({ type: 'mention', attrs: { id, label } });
const p = (...filhos: unknown[]) => ({ type: 'paragraph', content: filhos });
const doc = (...filhos: unknown[]) => ({ type: 'doc', content: filhos }) as TiptapDoc;

describe('extrairMencoes', () => {
  it('documento vazio, ou sem menção nenhuma, não produz nada', () => {
    expect(extrairMencoes(null)).toEqual([]);
    expect(extrairMencoes({ type: 'doc' })).toEqual([]);
    expect(extrairMencoes(doc(p(texto('nada aqui'))))).toEqual([]);
  });

  it('menção solta traz id, posição e o texto do bloco como contexto', () => {
    const mencoes = extrairMencoes(doc(p(texto('Vi '), mencao('m1', 'Morgana'), texto(' ontem.'))));
    expect(mencoes).toEqual([
      { targetId: 'm1', pos: 4, context: 'Vi @Morgana ontem.', isSecret: false },
    ]);
  });

  it('a mesma entidade duas vezes vira duas linhas, com posições diferentes', () => {
    const mencoes = extrairMencoes(
      doc(p(mencao('m1', 'Morgana'), texto(' e '), mencao('m1', 'Morgana'))),
    );
    expect(mencoes).toHaveLength(2);
    expect(mencoes.map((m) => m.targetId)).toEqual(['m1', 'm1']);
    expect(mencoes[0].pos).toBe(1);
    expect(mencoes[1].pos).toBe(5);
  });

  it('acha menção dentro de lista e de citação', () => {
    const dentroDeLista = doc({
      type: 'bulletList',
      content: [{ type: 'listItem', content: [p(mencao('m1', 'Roderick'))] }],
    });
    expect(extrairMencoes(dentroDeLista)).toEqual([
      { targetId: 'm1', pos: 3, context: '@Roderick', isSecret: false },
    ]);

    const dentroDeCitacao = doc({ type: 'blockquote', content: [p(mencao('m2', 'Alaric'))] });
    expect(extrairMencoes(dentroDeCitacao)[0]).toMatchObject({ targetId: 'm2', pos: 2 });
  });

  it('parágrafo vazio e linha horizontal não desalinham a posição', () => {
    // Um parágrafo vazio ocupa 2 (abre e fecha); a linha horizontal, 1.
    const comVazios = doc(p(), { type: 'horizontalRule' }, p(mencao('m1', 'X')));
    expect(extrairMencoes(comVazios)[0].pos).toBe(4);
  });

  it('contexto é recortado nas bordas, com reticências só do lado cortado', () => {
    const antes = 'a'.repeat(300);
    const depois = 'b'.repeat(300);

    const noMeio = extrairMencoes(doc(p(texto(antes), mencao('m1', 'M'), texto(depois))))[0];
    expect(noMeio.context.length).toBeLessThanOrEqual(182);
    expect(noMeio.context.startsWith('…')).toBe(true);
    expect(noMeio.context.endsWith('…')).toBe(true);
    expect(noMeio.context).toContain('@M');

    const noComeco = extrairMencoes(doc(p(mencao('m1', 'M'), texto(depois))))[0];
    expect(noComeco.context.startsWith('…')).toBe(false);
    expect(noComeco.context.endsWith('…')).toBe(true);

    const noFim = extrairMencoes(doc(p(texto(antes), mencao('m1', 'M'))))[0];
    expect(noFim.context.startsWith('…')).toBe(true);
    expect(noFim.context.endsWith('…')).toBe(false);
  });

  it('menção sem id é ignorada — sem id não é referência a nada', () => {
    expect(extrairMencoes(doc(p({ type: 'mention', attrs: { label: 'Fantasma' } })))).toEqual([]);
  });

  it('menção dentro de um nó secret sai marcada, para o backlink não vazar', () => {
    const comSegredo = doc({ type: 'secret', content: [p(mencao('m1', 'Morgana'))] });
    expect(extrairMencoes(comSegredo)[0]).toMatchObject({ targetId: 'm1', isSecret: true });
  });
});

// ── conferência contra o próprio ProseMirror ────────────────────────────────
// As posições acima estão calculadas à mão, fora do editor. Este teste crava o
// cálculo contra o schema de verdade: se um nó folha novo entrar no editor e a
// aritmética sair do lugar, ele quebra aqui e não em silêncio no banco.

describe('as posições batem com as do ProseMirror', () => {
  const schema = getSchema([
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    criarExtensaoDeMencao(() => ({ itens: [], tipos: [], aoCriar: () => {} })),
  ]);

  function posicoesReais(documento: TiptapDoc) {
    const posicoes: number[] = [];
    Node.fromJSON(schema, documento).descendants((no, pos) => {
      if (no.type.name === 'mention') posicoes.push(pos);
    });
    return posicoes;
  }

  const casos: Record<string, TiptapDoc> = {
    'menção solta': doc(p(texto('Vi '), mencao('m1', 'Morgana'), texto(' ontem.'))),
    repetida: doc(p(mencao('m1', 'M'), texto(' e '), mencao('m1', 'M'))),
    'em lista': doc({
      type: 'bulletList',
      content: [{ type: 'listItem', content: [p(mencao('m1', 'Roderick'))] }],
    }),
    'em citação': doc({ type: 'blockquote', content: [p(mencao('m2', 'Alaric'))] }),
    'depois de vazio e linha': doc(p(), { type: 'horizontalRule' }, p(mencao('m1', 'X'))),
    'em tarefa': doc({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(mencao('m3', 'Q'))] }],
    }),
    'vários blocos': doc(
      p(texto('um')),
      { type: 'heading', attrs: { level: 2 }, content: [texto('dois')] },
      p(texto('tres '), mencao('m1', 'M'), { type: 'hardBreak' }, texto('quatro')),
    ),
  };

  for (const [nome, documento] of Object.entries(casos)) {
    it(nome, () => {
      expect(extrairMencoes(documento).map((m) => m.pos)).toEqual(posicoesReais(documento));
    });
  }
});
