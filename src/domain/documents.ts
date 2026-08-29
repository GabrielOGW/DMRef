import { and, eq, exists, sql } from 'drizzle-orm';

import { db } from '@/db';
import type { TiptapDoc } from '@/db/schema';
import { campaigns, entities } from '@/db/schema';

/**
 * O corpo é a fonte da verdade (invariante 3). Aqui ele só é gravado: a derivação
 * de menções entra no PR 5, na mesma transação deste UPDATE.
 *
 * A posse vai no `WHERE`, não numa consulta antes: uma ida ao banco, e id de
 * entidade alheia simplesmente não casa.
 */
export async function salvarDocumento(input: {
  ownerId: string;
  entityId: string;
  content: TiptapDoc;
}) {
  const [linha] = await db
    .update(entities)
    .set({ content: input.content, updatedAt: new Date() })
    .where(
      and(
        eq(entities.id, input.entityId),
        exists(
          db
            .select({ um: sql`1` })
            .from(campaigns)
            .where(
              and(eq(campaigns.id, entities.campaignId), eq(campaigns.ownerId, input.ownerId)),
            ),
        ),
      ),
    )
    .returning({ updatedAt: entities.updatedAt });

  if (!linha) throw new Error('Documento não encontrado');
  return linha.updatedAt;
}
