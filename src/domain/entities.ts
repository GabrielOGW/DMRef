import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, entities, entityTypes } from '@/db/schema';

import { inserirComSlugUnico } from './slug.ts';

export type Entidade = typeof entities.$inferSelect;

/** Só as colunas que a lista da campanha mostra — `content` é grande e não é lido aqui. */
export function listarEntidades(campaignId: string) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      typeKey: entities.typeKey,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(eq(entities.campaignId, campaignId), isNull(entities.archivedAt)))
    .orderBy(desc(entities.updatedAt));
}

/**
 * Escopo por dono dentro da consulta: entidade de outra pessoa não existe.
 * O JOIN com `campaigns` é o motivo de as tabelas de usuário viverem no
 * mesmo banco (ARQUITETURA.md §3.5).
 */
export async function buscarEntidade(ownerId: string, campanhaSlug: string, entidadeSlug: string) {
  const [linha] = await db
    .select({ entidade: entities, campanha: campaigns })
    .from(entities)
    .innerJoin(campaigns, eq(campaigns.id, entities.campaignId))
    .where(
      and(
        eq(campaigns.ownerId, ownerId),
        eq(campaigns.slug, campanhaSlug),
        eq(entities.slug, entidadeSlug),
      ),
    )
    .limit(1);
  return linha;
}

/**
 * Entidade válida é `{ name, type }` — nada mais é exigido (invariante 4).
 * `id` no cliente é do PR 4; aqui o servidor gera.
 */
export async function criarEntidade(input: {
  campaignId: string;
  name: string;
  typeKey?: string;
  /** UUIDv7 vindo do cliente quando a entidade nasce de uma menção — ARQUITETURA.md §6.1. */
  id?: string;
}) {
  const name = input.name.trim();
  return inserirComSlugUnico(name, async (slug) => {
    const [entidade] = await db
      .insert(entities)
      .values({
        id: input.id ?? crypto.randomUUID(),
        campaignId: input.campaignId,
        typeKey: input.typeKey ?? 'nota',
        name,
        slug,
      })
      .onConflictDoNothing()
      .returning();
    return entidade;
  });
}

/** Tipos globais mais os da campanha. São dados, não enum (invariante 5). */
export function listarTiposDeEntidade(campaignId: string) {
  return db
    .select({ key: entityTypes.key, label: entityTypes.label })
    .from(entityTypes)
    .where(or(isNull(entityTypes.campaignId), eq(entityTypes.campaignId, campaignId)))
    .orderBy(asc(entityTypes.label));
}
