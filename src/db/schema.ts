import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Colunas são declaradas em camelCase e o Drizzle converte para snake_case
// (casing: 'snake_case' em drizzle.config.ts e em src/db/index.ts).
// Não nomeie colunas à mão — ver CLAUDE.md.

// ── tipos de apoio ──────────────────────────────────────────────────────────

/** Documento do Tiptap. A forma completa chega no PR 3; aqui basta tipar a coluna. */
export type TiptapDoc = { type: 'doc'; content?: unknown[] };

/** Campo declarado por um tipo de entidade. Fica vazio na Fase 0 — ver ARQUITETURA.md §4.1. */
export type FieldDef = {
  key: string;
  label: string;
  type: 'texto' | 'texto_longo' | 'numero' | 'booleano' | 'data' | 'selecao';
  options?: string[];
};

export type Visibility = 'publico' | 'mestre' | 'segredo' | 'revelado';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

// ── campanha ────────────────────────────────────────────────────────────────

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid().primaryKey(),
    // Sem FK até o PR 2: quem define a tabela de usuários é o Better Auth, pela
    // CLI dele. Adivinhar o schema aqui só criaria uma migração de conserto.
    ownerId: text().notNull(),
    worldId: uuid(), // null hoje; gancho para mundo compartilhado (ARQUITETURA.md §4)
    name: text().notNull(),
    slug: text().notNull(),
    system: text(), // "D&D 5e", "Fate"…
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('campaigns_owner_slug_idx').on(t.ownerId, t.slug)],
);

// ── tipos são dados, não enum ───────────────────────────────────────────────

export const entityTypes = pgTable(
  'entity_types',
  {
    id: uuid().primaryKey(),
    // NULL = tipo global, herdado por toda campanha.
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
    key: text().notNull(), // 'npc' | 'local' | 'faccao' | …
    label: text().notNull(),
    plural: text().notNull(),
    icon: text(), // nome do ícone lucide
    color: text(),
    isNarrative: boolean().default(false).notNull(),
    fields: jsonb().$type<FieldDef[]>().default([]).notNull(),
  },
  (t) => [
    uniqueIndex('entity_types_campaign_key_idx').on(t.campaignId, t.key),
    // O índice acima não cobre os tipos globais: no Postgres, NULLs são distintos
    // entre si, então (NULL, 'npc') nunca colide com (NULL, 'npc'). Este índice
    // parcial é o que impede o seed de duplicar os tipos padrão.
    uniqueIndex('entity_types_global_key_idx')
      .on(t.key)
      .where(sql`campaign_id is null`),
  ],
);

// ── o nó universal ──────────────────────────────────────────────────────────

export const entities = pgTable(
  'entities',
  {
    id: uuid().primaryKey(), // UUIDv7 gerado no cliente — ARQUITETURA.md §6.1
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    typeKey: text().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    summary: text(), // uma linha: hovercard, busca, cartão
    content: jsonb().$type<TiptapDoc>(), // corpo — FONTE DA VERDADE
    metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    tags: text().array().default([]).notNull(),
    status: text(), // 'vivo' | 'morto' | … livre por tipo
    visibility: text().$type<Visibility>().default('mestre').notNull(),
    coverUrl: text(),
    archivedAt: timestamp({ withTimezone: true }), // sem hard delete — §6.5
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    // Peso A = nome, B = resumo, C = corpo. jsonb_to_tsvector com o filtro
    // '["string"]' extrai só os valores string do documento do Tiptap, o que
    // dispensa manter uma coluna content_text em paralelo (ARQUITETURA.md §5.1).
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('portuguese'::regconfig, coalesce(name, '')), 'A') || setweight(to_tsvector('portuguese'::regconfig, coalesce(summary, '')), 'B') || setweight(jsonb_to_tsvector('portuguese'::regconfig, coalesce(content, '{}'::jsonb), '["string"]'), 'C')`,
    ),
  },
  (t) => [
    uniqueIndex('entities_campaign_slug_idx').on(t.campaignId, t.slug),
    index('entities_campaign_type_idx').on(t.campaignId, t.typeKey),
    index('entities_campaign_updated_idx').on(t.campaignId, t.updatedAt), // dashboard "recentes"
    index('entities_search_idx').using('gin', t.searchVector),
    index('entities_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('entities_tags_idx').using('gin', t.tags),
  ],
);

// ── extensões 1:1, só onde a consulta exige (ARQUITETURA.md §4.2) ───────────

export const sessions = pgTable(
  'sessions',
  {
    entityId: uuid()
      .primaryKey()
      .references(() => entities.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    number: integer().notNull(),
    playedAt: date(),
    actId: uuid().references(() => entities.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('sessions_campaign_number_idx').on(t.campaignId, t.number)],
);

export const events = pgTable(
  'events',
  {
    entityId: uuid()
      .primaryKey()
      .references(() => entities.id, { onDelete: 'cascade' }),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    // Inteiro ordenável, não data. Nada de motor de calendário — ARQUITETURA.md §7.2.
    inWorldSort: bigint({ mode: 'number' }),
    inWorldLabel: text(), // "1045 DR, véspera de Lumina"
    sessionId: uuid().references(() => sessions.entityId, { onDelete: 'set null' }),
    locationId: uuid().references(() => entities.id, { onDelete: 'set null' }),
  },
  (t) => [index('events_campaign_sort_idx').on(t.campaignId, t.inWorldSort)],
);

// ── menções: DERIVADAS, nunca escritas à mão (ARQUITETURA.md §6.2) ──────────

export const mentions = pgTable(
  'entity_mentions',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    pos: integer().notNull(), // posição ProseMirror → "pular para"
    context: text().notNull(), // ~180 chars ao redor, para o backlink
    isSecret: boolean().default(false).notNull(),
  },
  (t) => [
    uniqueIndex('entity_mentions_source_target_pos_idx').on(t.sourceId, t.targetId, t.pos),
    index('entity_mentions_target_idx').on(t.targetId), // "onde aparece" — a consulta quente
  ],
);

// ── relações: EXPLÍCITAS, escritas à mão (ARQUITETURA.md §4.5) ──────────────

export const relationshipTypes = pgTable(
  'relationship_types',
  {
    id: uuid().primaryKey(),
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    label: text().notNull(),
    inverse: text().notNull(),
    symmetric: boolean().default(false).notNull(),
  },
  (t) => [
    uniqueIndex('relationship_types_campaign_key_idx').on(t.campaignId, t.key),
    // Mesmo motivo do entity_types: NULLs distintos deixariam os tipos globais duplicáveis.
    uniqueIndex('relationship_types_global_key_idx')
      .on(t.key)
      .where(sql`campaign_id is null`),
  ],
);

export const relationships = pgTable(
  'entity_relationships',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    typeKey: text().notNull(),
    status: text(),
    startsAt: bigint({ mode: 'number' }), // mesma escala de inWorldSort
    endsAt: bigint({ mode: 'number' }),
    note: text(),
    isSecret: boolean().default(false).notNull(),
  },
  (t) => [
    index('entity_relationships_source_idx').on(t.sourceId),
    index('entity_relationships_target_idx').on(t.targetId),
  ],
);

// ── caixa de entrada narrativa (fase 2) — DERIVADA ──────────────────────────

export const openThreads = pgTable(
  'open_threads',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceId: uuid()
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    pos: integer().notNull(),
    text: text().notNull(),
    resolved: boolean().default(false).notNull(),
  },
  (t) => [index('open_threads_campaign_resolved_idx').on(t.campaignId, t.resolved)],
);
