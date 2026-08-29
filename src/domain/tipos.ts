import { and, asc, count, eq, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entities, entityTypes } from '@/db/schema';

import { slugify } from './slug.ts';

/**
 * Tipos são dados, não enum (invariante 5). Os globais têm `campaign_id NULL` e
 * são herdados por toda campanha — **é o schema que impede apagá-los**, porque
 * uma campanha só alcança as linhas dela. Não existe caminho de exclusão para os
 * padrões porque não existe caminho de exclusão nenhum, e é de propósito: apagar
 * um tipo deixaria entidades apontando para uma chave que não existe mais.
 */
export function listarTiposDeEntidade(campaignId: string) {
  return db
    .select({ key: entityTypes.key, label: entityTypes.label })
    .from(entityTypes)
    .where(or(isNull(entityTypes.campaignId), eq(entityTypes.campaignId, campaignId)))
    .orderBy(asc(entityTypes.label));
}

/** Os tipos com quantas páginas cada um tem — o que a barra lateral mostra. */
export function contarPorTipo(campaignId: string) {
  return db
    .select({
      key: entityTypes.key,
      label: entityTypes.label,
      plural: entityTypes.plural,
      icon: entityTypes.icon,
      proprio: sql<boolean>`${entityTypes.campaignId} is not null`,
      quantas: count(entities.id),
    })
    .from(entityTypes)
    .leftJoin(
      entities,
      and(
        eq(entities.typeKey, entityTypes.key),
        eq(entities.campaignId, campaignId),
        isNull(entities.archivedAt),
      ),
    )
    .where(or(isNull(entityTypes.campaignId), eq(entityTypes.campaignId, campaignId)))
    .groupBy(entityTypes.id)
    .orderBy(asc(entityTypes.plural));
}

export function listarPorTipo(campaignId: string, typeKey: string) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      slug: entities.slug,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(
      and(
        eq(entities.campaignId, campaignId),
        eq(entities.typeKey, typeKey),
        isNull(entities.archivedAt),
      ),
    )
    .orderBy(asc(entities.name));
}

export async function buscarTipo(campaignId: string, key: string) {
  const [tipo] = await db
    .select({ key: entityTypes.key, label: entityTypes.label, plural: entityTypes.plural })
    .from(entityTypes)
    .where(
      and(
        eq(entityTypes.key, key),
        or(isNull(entityTypes.campaignId), eq(entityTypes.campaignId, campaignId)),
      ),
    )
    .limit(1);
  return tipo;
}

/**
 * Categoria nova, da campanha. Um campo só: o texto vira `label` e `plural` ao
 * mesmo tempo, porque português não tem plural derivável ("facção" → "facções")
 * e dois campos numa barra lateral é atrito para um ganho cosmético.
 */
export async function criarTipoDeEntidade(campaignId: string, nome: string) {
  const label = nome.trim();
  const key = slugify(label);
  if (!key) throw new Error('Nome inválido');

  // Chave repetida escureceria um tipo global e apareceria duas vezes na lista.
  if (await buscarTipo(campaignId, key)) throw new Error(`Já existe uma categoria "${label}"`);

  await db.insert(entityTypes).values({ id: crypto.randomUUID(), campaignId, key, label, plural: label });
  return { key, label };
}
