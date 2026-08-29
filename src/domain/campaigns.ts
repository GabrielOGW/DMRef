import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns } from '@/db/schema';

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
