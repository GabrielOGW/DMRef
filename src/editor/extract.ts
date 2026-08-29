import type { TiptapDoc } from '@/db/schema';

/** Uma menção como ela sai do documento — ainda sem campanha nem origem. */
export type MencaoExtraida = {
  targetId: string;
  /** Posição ProseMirror do nó, para o "pular para" da página da entidade. */
  pos: number;
  /** Trecho ao redor, congelado na derivação: o backlink não reparseia o documento. */
  context: string;
  isSecret: boolean;
};

/** ~180 caracteres ao redor da menção (ARQUITETURA.md §5.2). */
const JANELA = 180;

/**
 * Nós que ocupam uma posição só. Todo o resto é contêiner e vale abertura +
 * conteúdo + fechamento — inclusive o parágrafo vazio, que o Tiptap serializa
 * sem `content`.
 *
 * ponytail: lista, não heurística. Se um nó folha novo entrar no schema do
 * editor, ele entra aqui junto — é o preço de calcular posição fora do
 * ProseMirror, e o teste do parágrafo vazio segura a ponta.
 */
const FOLHAS = new Set(['mention', 'horizontalRule', 'hardBreak', 'image']);

type No = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: unknown[] };

const ehInline = (no: No) => no.type === 'text' || no.type === 'mention' || no.type === 'hardBreak';

/**
 * JSON entra, menções saem. Função pura: é a única lógica que, quebrando em
 * silêncio, corrompe dados — por isso mora sozinha e testada (ARQUITETURA.md §8).
 */
export function extrairMencoes(doc: TiptapDoc | null | undefined): MencaoExtraida[] {
  const saida: MencaoExtraida[] = [];
  percorrer((doc?.content ?? []) as No[], 0, false, saida);
  return saida;
}

function percorrer(nos: No[], pos: number, segredo: boolean, saida: MencaoExtraida[]): number {
  // Conteúdo inline: monta o texto do bloco de uma vez, que é o contexto do backlink.
  if (nos.some(ehInline)) {
    let texto = '';
    const aqui: { targetId: string; pos: number; offset: number }[] = [];

    for (const no of nos) {
      if (no.type === 'text') {
        texto += no.text ?? '';
        pos += (no.text ?? '').length;
      } else if (no.type === 'mention') {
        const id = no.attrs?.id;
        // A menção guarda o id (invariante 1). Sem id ela não é referência nenhuma.
        if (typeof id === 'string' && id) aqui.push({ targetId: id, pos, offset: texto.length });
        texto += `@${no.attrs?.label ?? ''}`;
        pos += 1;
      } else if (no.type === 'hardBreak') {
        texto += ' ';
        pos += 1;
      } else {
        pos = percorrer((no.content ?? []) as No[], pos + 1, segredo, saida) + 1;
      }
    }

    for (const m of aqui) {
      saida.push({
        targetId: m.targetId,
        pos: m.pos,
        context: recortar(texto, m.offset),
        isSecret: segredo,
      });
    }
    return pos;
  }

  for (const no of nos) {
    if (no.type && FOLHAS.has(no.type)) {
      pos += 1;
      continue;
    }
    pos += 1;
    // Menção dentro de um nó `secret` não pode vazar pelo backlink (invariante 7).
    pos = percorrer((no.content ?? []) as No[], pos, segredo || no.type === 'secret', saida);
    pos += 1;
  }
  return pos;
}

function recortar(texto: string, offset: number) {
  if (texto.length <= JANELA) return texto;
  const fim = Math.min(texto.length, Math.max(0, offset - JANELA / 2) + JANELA);
  const inicio = Math.max(0, fim - JANELA);
  return `${inicio > 0 ? '…' : ''}${texto.slice(inicio, fim)}${fim < texto.length ? '…' : ''}`;
}
