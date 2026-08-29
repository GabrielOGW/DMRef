import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entities, sessions } from '@/db/schema';

import { slugify } from './slug.ts';

const TENTATIVAS = 3;

/** "Sessão 01" — dois dígitos para a lista sair em ordem também no olho. */
const nomeDaSessao = (numero: number) => `Sessão ${String(numero).padStart(2, '0')}`;

/**
 * A sessão é uma entidade como qualquer outra (invariante 3) mais uma linha na
 * extensão 1:1 `sessions`, que existe só porque a consulta de histórico precisa
 * ordenar por número (ARQUITETURA.md §4.2). As duas escritas vão no mesmo lote:
 * entidade sem a linha da extensão seria uma sessão sem número.
 *
 * O número é o próximo da campanha. O índice único (campaign_id, number) é quem
 * decide de verdade; daí a repetição em vez de confiar no `max()` lido.
 */
export async function criarSessao(campaignId: string) {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const [{ maximo }] = await db
      .select({ maximo: sql<number>`coalesce(max(${sessions.number}), 0)` })
      .from(sessions)
      .where(eq(sessions.campaignId, campaignId));

    const number = Number(maximo) + 1;
    const name = nomeDaSessao(number);
    const id = crypto.randomUUID();

    try {
      await db.batch([
        db
          .insert(entities)
          .values({ id, campaignId, typeKey: 'sessao', name, slug: slugify(name) }),
        db.insert(sessions).values({
          entityId: id,
          campaignId,
          number,
          // Data real de quando se jogou; o tempo interno é outro assunto (§7.2).
          playedAt: new Date().toISOString().slice(0, 10),
        }),
      ]);
      return { id, slug: slugify(name), name, number };
    } catch (erro) {
      // Alguém pegou este número no meio do caminho. Na última tentativa, o erro
      // é o erro — engolir três vezes já seria esconder outra coisa.
      if (tentativa === TENTATIVAS) throw erro;
    }
  }
  throw new Error('inalcançável');
}

export function listarSessoes(campaignId: string) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      number: sessions.number,
      playedAt: sessions.playedAt,
    })
    .from(sessions)
    .innerJoin(entities, eq(entities.id, sessions.entityId))
    .where(eq(sessions.campaignId, campaignId))
    .orderBy(asc(sessions.number));
}
