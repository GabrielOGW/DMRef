import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, entities, mentions, sessions } from '@/db/schema';
import { extrairMencoes } from '@/editor/extract';

import { montarExemplo, NOME_DA_CAMPANHA, SLUG_DA_CAMPANHA } from './exemplo.ts';
import { inserirComSlugUnico } from './slug.ts';

export type Campanha = typeof campaigns.$inferSelect;

export function listarCampanhas(ownerId: string) {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.ownerId, ownerId))
    .orderBy(desc(campaigns.updatedAt));
}

export async function buscarCampanha(ownerId: string, slug: string) {
  const [campanha] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.ownerId, ownerId), eq(campaigns.slug, slug)))
    .limit(1);
  return campanha;
}

/** O slug é único por dono (campaigns_owner_slug_idx). */
export async function criarCampanha(input: { ownerId: string; name: string; system?: string }) {
  const name = input.name.trim();
  return inserirComSlugUnico(name, async (slug) => {
    const [campanha] = await db
      .insert(campaigns)
      .values({
        id: crypto.randomUUID(),
        ownerId: input.ownerId,
        name,
        slug,
        system: input.system?.trim() || null,
      })
      .onConflictDoNothing()
      .returning();
    return campanha;
  });
}

/**
 * A campanha-tutorial, com as páginas já escritas e as menções já derivadas.
 * O texto dela mora em `exemplo.ts`, que é puro; aqui é só a gravação.
 *
 * Idempotente por dono: quem clicar duas vezes volta para a mesma campanha, em
 * vez de ganhar uma "comece-aqui-2" com o conteúdo repetido. É por isso que o
 * slug é fixo, e não passa pelo `inserirComSlugUnico` das outras criações.
 *
 * As menções saem do `extrairMencoes`, o mesmo caminho de um salvamento normal
 * (invariante 2). O exemplo não escreve `entity_mentions` à mão: se a derivação
 * quebrar, o tutorial quebra junto — e é bom que quebre.
 */
export async function criarCampanhaDeExemplo(ownerId: string) {
  const existente = await buscarCampanha(ownerId, SLUG_DA_CAMPANHA);
  if (existente) return existente;

  const [campanha] = await db
    .insert(campaigns)
    .values({
      id: crypto.randomUUID(),
      ownerId,
      name: NOME_DA_CAMPANHA,
      slug: SLUG_DA_CAMPANHA,
    })
    .returning();

  const paginas = montarExemplo();
  const agora = Date.now();
  const hoje = new Date(agora).toISOString().slice(0, 10);

  await db.batch([
    db.insert(entities).values(
      paginas.map((pagina, indice) => ({
        id: pagina.id,
        campaignId: campanha.id,
        typeKey: pagina.typeKey,
        name: pagina.name,
        slug: pagina.slug,
        content: pagina.content,
        // A lista da campanha ordena por updatedAt desc. Um segundo de diferença
        // por página põe o "Comece aqui" no topo, que é onde um tutorial serve.
        updatedAt: new Date(agora - indice * 1000),
      })),
    ),
    db.insert(sessions).values(
      paginas.flatMap((pagina) =>
        pagina.numeroDaSessao === undefined
          ? []
          : [
              {
                entityId: pagina.id,
                campaignId: campanha.id,
                number: pagina.numeroDaSessao,
                playedAt: hoje,
              },
            ],
      ),
    ),
    db.insert(mentions).values(
      paginas.flatMap((pagina) =>
        extrairMencoes(pagina.content).map((mencao) => ({
          campaignId: campanha.id,
          sourceId: pagina.id,
          ...mencao,
        })),
      ),
    ),
  ]);

  return campanha;
}
