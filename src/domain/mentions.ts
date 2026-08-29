import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { entities, mentions, sessions } from '@/db/schema';

/**
 * "Onde aparece": uma consulta só, apoiada no índice `entity_mentions_target_idx`.
 * O contexto já vem congelado da derivação — nenhum documento de origem é
 * carregado ou reparseado aqui (ARQUITETURA.md §6.3).
 *
 * O `ORDER BY` pelo número da sessão é o que faz o histórico sair na ordem da
 * ficção, e não na de edição. Sessões chegam no PR 6; até lá o join é sempre nulo.
 *
 * Segredos ainda não existem (o nó `secret` é da fase 1), então `is_secret` é
 * sempre falso. Quando existirem, o filtro por leitor entra aqui — o portal do
 * jogador não pode ver o que o mestre escondeu (invariante 7).
 */
export function backlinks(targetId: string) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      typeKey: entities.typeKey,
      context: mentions.context,
      pos: mentions.pos,
      sessao: sessions.number,
    })
    .from(mentions)
    .innerJoin(entities, eq(entities.id, mentions.sourceId))
    .leftJoin(sessions, eq(sessions.entityId, mentions.sourceId))
    .where(and(eq(mentions.targetId, targetId), eq(mentions.isSecret, false)))
    .orderBy(asc(sessions.number), asc(entities.createdAt), asc(mentions.pos));
}
