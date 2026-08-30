import { describe, expect, it } from 'vitest';

import { extrairMencoes } from '@/editor/extract';

import { montarExemplo, SLUG_DA_ENTRADA } from './exemplo.ts';

const paginas = montarExemplo();
const porSlug = new Map(paginas.map((pagina) => [pagina.slug, pagina]));
const ids = new Set(paginas.map((pagina) => pagina.id));

describe('montarExemplo', () => {
  it('a página de entrada existe e é a primeira da lista', () => {
    // O `updatedAt` escalonado na gravação depende desta ordem, e a Server Action
    // redireciona para este slug.
    expect(porSlug.has(SLUG_DA_ENTRADA)).toBe(true);
    expect(paginas[0].slug).toBe(SLUG_DA_ENTRADA);
  });

  it('slugs e ids são únicos', () => {
    // Slug repetido explodiria no índice único (campaign_id, slug) só na gravação.
    expect(porSlug.size).toBe(paginas.length);
    expect(ids.size).toBe(paginas.length);
  });

  it('toda página tem corpo — o exemplo é o conteúdo', () => {
    for (const pagina of paginas) {
      expect(pagina.content.type).toBe('doc');
      expect(pagina.content.content?.length ?? 0).toBeGreaterThan(0);
    }
  });

  /**
   * O teste que justifica o arquivo. Uma menção apontando para um id fora do
   * elenco não quebra nada de forma visível: `salvarDocumento` descarta menção
   * órfã de propósito, então o tutorial simplesmente apareceria sem backlink,
   * ensinando errado a única coisa que ele existe para ensinar.
   */
  it('toda menção aponta para uma página do próprio exemplo', () => {
    for (const pagina of paginas) {
      for (const mencao of extrairMencoes(pagina.content)) {
        expect(ids.has(mencao.targetId), `${pagina.slug} menciona id de fora`).toBe(true);
      }
    }
  });

  it('o rótulo de cada menção é o nome atual da página alvo', () => {
    const nomePorId = new Map(paginas.map((pagina) => [pagina.id, pagina.name]));
    for (const pagina of paginas) {
      for (const mencao of extrairMencoes(pagina.content)) {
        // O contexto congelado escreve `@Rótulo`; rótulo errado sairia no backlink.
        expect(mencao.context).toContain(`@${nomePorId.get(mencao.targetId)}`);
      }
    }
  });

  it('a sessão é uma só, numerada 1, e é quem alimenta o Histórico', () => {
    const sessoes = paginas.filter((pagina) => pagina.numeroDaSessao !== undefined);
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].numeroDaSessao).toBe(1);
    expect(sessoes[0].typeKey).toBe('sessao');

    // A Morgana é o exemplo de backlink do tutorial: se a sessão parar de citá-la,
    // a página dela promete um "Histórico" que não vai existir.
    const morgana = paginas.find((pagina) => pagina.name === 'Lady Morgana');
    const alvos = extrairMencoes(sessoes[0].content).map((mencao) => mencao.targetId);
    expect(alvos).toContain(morgana?.id);
  });

  it('cada chamada gera ids novos — duas campanhas não compartilham entidade', () => {
    const outras = montarExemplo();
    for (const pagina of outras) expect(ids.has(pagina.id)).toBe(false);
  });
});
