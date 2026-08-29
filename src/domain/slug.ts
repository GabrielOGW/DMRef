/** "Sombras de Valoria" -> "sombras-de-valoria". Usado por campanhas e, no PR 4, por entidades. */
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
