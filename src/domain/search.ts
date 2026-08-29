import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entities } from '@/db/schema';

const LIMITE = 10;

/**
 * A paleta do `Ctrl+K`, por nome. **Não use o operador `%`** aqui: `similarity()`
 * divide pelos trigramas do nome inteiro, então quanto mais longo o nome, mais
 * uma consulta curta é penalizada — e consulta curta é justamente o que uma
 * paleta recebe. Medido contra o banco no PR 1: `morg` não acha Lady Morgana e
 * `rod` não acha Capitão Roderick. Tabela em ARQUITETURA.md §3.6.
 *
 * `ILIKE` pega a subcadeia exata (o caso comum) e `<%` cobre erro de digitação;
 * os dois usam o mesmo índice GIN `gin_trgm_ops`. A ordem é por
 * `word_similarity()`, que compara a consulta com o melhor trecho de palavra
 * dentro do nome e não sofre do problema acima.
 */
export function buscarPorNome(campaignId: string, consulta: string) {
  const termo = consulta.trim();
  if (!termo) return [];

  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      typeKey: entities.typeKey,
    })
    .from(entities)
    .where(
      and(
        eq(entities.campaignId, campaignId),
        isNull(entities.archivedAt),
        sql`(${entities.name} ilike ${`%${termo}%`} or ${termo} <% ${entities.name})`,
      ),
    )
    .orderBy(
      sql`word_similarity(${termo}, ${entities.name}) desc`,
      sql`length(${entities.name})`,
      entities.name,
    )
    .limit(LIMITE);
}
