import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import type { TiptapDoc } from '@/db/schema';
import { campaigns, entities, mentions } from '@/db/schema';
import { extrairMencoes } from '@/editor/extract';

/**
 * O corpo é a fonte da verdade (invariante 3); as menções são **derivadas** dele
 * a cada salvamento (invariante 2). Apaga-e-reinsere em vez de diff: o estado
 * derivado vira função pura do documento, sem divergência para depurar
 * (ARQUITETURA.md §6.2).
 *
 * O driver HTTP do Neon não tem transação interativa, então a posse é conferida
 * numa leitura antes e as três escritas vão num `batch`, que é uma transação só.
 */
export async function salvarDocumento(input: {
  ownerId: string;
  entityId: string;
  content: TiptapDoc;
}) {
  const [alvo] = await db
    .select({ campaignId: entities.campaignId })
    .from(entities)
    .innerJoin(campaigns, eq(campaigns.id, entities.campaignId))
    .where(and(eq(entities.id, input.entityId), eq(campaigns.ownerId, input.ownerId)))
    .limit(1);

  if (!alvo) throw new Error('Documento não encontrado');

  const derivadas = await mencoesGravaveis(alvo.campaignId, input.entityId, input.content);
  const atualizadoEm = new Date();

  await db.batch([
    db
      .update(entities)
      .set({ content: input.content, updatedAt: atualizadoEm })
      .where(eq(entities.id, input.entityId)),
    db.delete(mentions).where(eq(mentions.sourceId, input.entityId)),
    ...(derivadas.length ? [db.insert(mentions).values(derivadas)] : []),
  ] as unknown as Parameters<typeof db.batch>[0]);

  return atualizadoEm;
}

/**
 * A entidade mencionada nasce por uma Server Action em segundo plano (§6.1), que
 * pode não ter chegado ainda. Menção órfã sai fora desta gravação em vez de
 * derrubar o salvamento inteiro por chave estrangeira: o texto do usuário é
 * inegociável, a linha derivada volta sozinha no salvamento seguinte.
 */
async function mencoesGravaveis(campaignId: string, sourceId: string, doc: TiptapDoc) {
  const extraidas = extrairMencoes(doc);
  if (!extraidas.length) return [];

  const alvos = [...new Set(extraidas.map((m) => m.targetId))];
  const existentes = new Set(
    (
      await db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.campaignId, campaignId), inArray(entities.id, alvos)))
    ).map((e) => e.id),
  );

  return extraidas
    .filter((m) => existentes.has(m.targetId))
    .map((m) => ({ campaignId, sourceId, ...m }));
}
