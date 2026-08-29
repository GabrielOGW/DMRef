import type { TiptapDoc } from '@/db/schema';

/**
 * O `label` do nó de menção é **cache de exibição**: quem manda é o `name` da
 * entidade (ARQUITETURA.md §6.4). Sem esta revalidação, renomear a Lady Morgana
 * deixaria "@Morgana" congelado em todo texto antigo — e o §6.4 promete que
 * renomear é um `UPDATE` de uma linha, o que só é verdade com isto aqui.
 *
 * Puro, e barato: o mapa `id → nome` já vem carregado para o autocomplete do `@`.
 * Devolve o mesmo documento quando nada mudou, para não trocar a referência à toa.
 */
export function revalidarRotulos(
  doc: TiptapDoc | null,
  nomes: Map<string, string>,
): TiptapDoc | null {
  if (!doc) return doc;
  const revisado = percorrer(doc, nomes);
  return (revisado as TiptapDoc | null) ?? doc;
}

/** Devolve o nó reconstruído, ou `null` quando nada abaixo dele mudou. */
function percorrer(no: unknown, nomes: Map<string, string>): unknown {
  if (!no || typeof no !== 'object') return null;
  const atual = no as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };

  if (atual.type === 'mention') {
    const id = atual.attrs?.id;
    if (typeof id !== 'string') return null;
    const nome = nomes.get(id);
    if (nome === undefined || nome === atual.attrs?.label) return null;
    return { ...atual, attrs: { ...atual.attrs, label: nome } };
  }

  if (!Array.isArray(atual.content)) return null;

  let mudou = false;
  const filhos = atual.content.map((filho) => {
    const revisado = percorrer(filho, nomes);
    if (revisado === null) return filho;
    mudou = true;
    return revisado;
  });

  return mudou ? { ...atual, content: filhos } : null;
}
