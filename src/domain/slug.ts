/** "Sombras de Valoria" -> "sombras-de-valoria". Usado por campanhas e por entidades. */
export function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // tira as marcas combinantes que o NFD separou
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/**
 * Insere deixando o índice único decidir a colisão, em vez de consultar antes e
 * correr o risco da corrida. `inserir` devolve `undefined` quando o slug colidiu
 * (`onConflictDoNothing`), e aí tentamos `base-2`, `base-3`…
 *
 * ponytail: cinco tentativas sequenciais. Se alguém tiver seis páginas com o
 * mesmo nome, um sufixo aleatório resolve — trocar só quando acontecer.
 */
export async function inserirComSlugUnico<T>(
  nome: string,
  inserir: (slug: string) => Promise<T | undefined>,
): Promise<T> {
  const base = slugify(nome) || 'sem-nome';
  for (let n = 1; n <= 5; n++) {
    const linha = await inserir(n === 1 ? base : `${base}-${n}`);
    if (linha) return linha;
  }
  throw new Error(`Não consegui um slug livre a partir de "${base}"`);
}
