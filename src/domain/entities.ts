import { and, desc, eq, exists, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, entities } from '@/db/schema';

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

/**
 * Alteração de uma entidade com a posse dentro do `WHERE`, por `EXISTS` sobre
 * `campaigns`: uma ida ao banco, e id de outra pessoa simplesmente não casa.
 */
async function atualizar(
  ownerId: string,
  entityId: string,
  valores: Partial<typeof entities.$inferInsert>,
) {
  const [linha] = await db
    .update(entities)
    .set({ ...valores, updatedAt: new Date() })
    .where(
      and(
        eq(entities.id, entityId),
        exists(
          db
            .select({ um: sql`1` })
            .from(campaigns)
            .where(and(eq(campaigns.id, entities.campaignId), eq(campaigns.ownerId, ownerId))),
        ),
      ),
    )
    .returning({ slug: entities.slug });

  if (!linha) throw new Error('Página não encontrada');
  return linha;
}

/**
 * Renomear é `UPDATE name` e nada mais (ARQUITETURA.md §6.4). O slug não muda —
 * ele é o endereço, e renomear não pode quebrar link que já existe. Os documentos
 * guardam id; o `label` do nó é cache revalidado na renderização.
 */
export function renomearEntidade(ownerId: string, entityId: string, nome: string) {
  const name = nome.trim();
  if (!name) throw new Error('Nome vazio');
  return atualizar(ownerId, entityId, { name });
}

/** Tipos são dados: trocar é uma coluna, não uma migração (invariante 5). */
export function mudarTipoDaEntidade(ownerId: string, entityId: string, typeKey: string) {
  return atualizar(ownerId, entityId, { typeKey });
}

/**
 * Sem hard delete (invariante 8, §6.5): apagar deixaria nó órfão no meio de texto
 * que alguém escreveu. `archivedAt` some das listas e da busca, e a página
 * continua alcançável pela URL — é de lá que se desarquiva.
 */
export function arquivarEntidade(ownerId: string, entityId: string) {
  return atualizar(ownerId, entityId, { archivedAt: new Date() });
}

export function desarquivarEntidade(ownerId: string, entityId: string) {
  return atualizar(ownerId, entityId, { archivedAt: null });
}
