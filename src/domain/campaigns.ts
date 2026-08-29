import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns } from '@/db/schema';

import { slugify } from './slug.ts';

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

/**
 * O slug é único por dono (campaigns_owner_slug_idx). Em vez de consultar antes
 * e correr o risco da corrida, tentamos inserir e deixamos o índice decidir.
 *
 * ponytail: até 5 tentativas sequenciais; se alguém tiver seis campanhas com o
 * mesmo nome, sufixo aleatório resolve — trocar só quando acontecer.
 */
export async function criarCampanha(input: { ownerId: string; name: string; system?: string }) {
  const name = input.name.trim();
  const base = slugify(name) || 'campanha';

  for (let n = 1; n <= 5; n++) {
    const [campanha] = await db
      .insert(campaigns)
      .values({
        id: crypto.randomUUID(),
        ownerId: input.ownerId,
        name,
        slug: n === 1 ? base : `${base}-${n}`,
        system: input.system?.trim() || null,
      })
      .onConflictDoNothing()
      .returning();
    if (campanha) return campanha;
  }
  throw new Error(`Não consegui um slug livre a partir de "${base}"`);
}
