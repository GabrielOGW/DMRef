# Arquitetura — Grimório

> Documento de decisão técnica. Escrito antes da primeira linha de código, em 2026-08-28.
> Versão navegável: <https://claude.ai/code/artifact/5ab940f9-811e-4173-bbdf-c0b9114b3ad1>

**Tese:** uma wiki de campanha onde a estrutura é *derivada da escrita*, não preenchida em
formulários. Você escreve a sessão; o sistema descobre quem apareceu, onde, e o que aconteceu.

---

## 1. Visão do produto

Grimório é um banco de conhecimento conectado, de uso pessoal, cuja interface primária de
entrada é o caderno de sessão.

Três afirmações definem o escopo — cada uma exclui coisas:

### 1.1 A sessão é a fonte primária, não a ficha

Em World Anvil e Kanka você constrói o mundo primeiro e registra as sessões depois, como
subproduto. Aqui é o inverso: o texto da sessão é onde a informação nasce, e as entidades se
cristalizam a partir dele. Isso não é preferência de UX — define o modelo de dados. Menções não
são metadados opcionais; são **o mecanismo de estruturação**.

### 1.2 Estrutura é derivada, nunca obrigatória

Uma entidade válida é `{ nome, tipo }`. Tudo além disso é opcional e preenchível depois. O
sistema nunca bloqueia a escrita para pedir um campo. Corolário: campos estruturados existem
para *consultas* (ordenar a timeline, listar sessões de um ato), não para completude.

### 1.3 É software de um usuário só, com porta para dois

O mestre é o único escritor. Jogadores, quando existirem, são **leitores de uma projeção
filtrada** — nunca coautores. Isso elimina de uma vez: colaboração em tempo real, CRDTs,
resolução de conflitos, permissões granulares, convites, papéis. Adotar essa restrição agora é
o que permite o resto ser simples.

> **Frase-guia.** Se uma feature exige que você pare de escrever para configurá-la, ela está
> errada. Se ela aparece sozinha depois que você escreveu, está certa.

---

## 2. Benchmark

| Ferramenta | Força real | Falha real | O que roubar |
|---|---|---|---|
| **Obsidian** | Escrita instantânea, links de primeira classe, backlinks, teclado | Identidade = nome do arquivo (renomear é frágil); sem consultas estruturadas; sem tipo; sem timeline | Painel de backlinks; `[[` que abre autocomplete; ausência de formulários |
| **LegendKeeper** | Wiki rápida e bonita, mapas com pins ligados a páginas | Modelo narrativo pobre — atos/arcos/sessões são páginas comuns; sem timeline forte; pago | Velocidade percebida; mapa-como-índice (o pin *é* um link) |
| **World Anvil** | Timeline conectada a entidades; templates por tipo | Formulário sobre formulário; dezenas de campos quase sempre vazios; lento | Timeline ligada a entidades. **Nunca** os templates de 40 campos |
| **Kanka** | Tipagem + relações explícitas + isolamento por campanha + visibilidade | Lista de tipos fechada; tudo por formulário; relações preenchidas à mão (logo, ninguém preenche) | Modelo de relações com tipo; visibilidade por entidade |
| **Notion** | Blocos + banco na mesma superfície; `@` menciona qualquer página | Menção é só link — não gera histórico nem consulta; genérico demais e lento | `@` como gesto universal, `/` como paleta de blocos |

### A brecha

Existe uma linha divisória clara: **Obsidian é livre mas burro; World Anvil e Kanka são
estruturados mas burocráticos.** Ninguém ocupa o meio, porque o meio exige uma coisa difícil:
*extrair estrutura de prosa livre em tempo de escrita*. É onde deve estar 80% do esforço.

**Diferencial:** escrever `@Lady_Morgana foi vista na @Floresta_Negra` na Sessão 03 faz a página
da Morgana ganhar uma linha no histórico ordenada por número de sessão, a Floresta Negra ganhar
uma menção, e a timeline poder receber o evento com um `/evento`. Zero formulários abertos.
Nenhuma das cinco ferramentas faz isso.

> **Aviso honesto.** Existe um motivo para o meio estar vazio: é o quadrante mais difícil. Se o
> autocomplete de menção tiver 300 ms de latência, ou se criar um NPC no meio da frase custar
> dois cliques a mais do que deveria, você volta pro Obsidian em duas sessões. **A qualidade do
> editor é o produto.** Qualquer coisa que atrapalhe o fluxo de digitação é bug P0.

---

## 3. Decisões de stack

Resumo: **Next.js 16 (App Router) · Neon Postgres · Drizzle · Tiptap · Better Auth ·
pg_trgm + FTS · Tailwind + shadcn/ui · Zod · Vitest.** Custo: R$ 0 — ver
[CUSTO-ZERO.md](CUSTO-ZERO.md).

### 3.1 Next.js 16, App Router

> Escrito assumindo Next 15; o scaffold (PR 0, ago/2026) instalou **Next 16.3.3** com
> React 19.2, Tailwind 4 e Turbopack. Nada nesta arquitetura muda: Server Components, Server
> Actions e Route Handlers têm a mesma forma. Cache Components/PPR são opt-in e continuam fora
> do escopo.

Server Components entregam a página da entidade já renderizada com backlinks agregados no
servidor — exatamente o padrão de carga aqui (muita leitura, uma consulta agregadora, pouca
interatividade). O editor é a única ilha cliente relevante.

> **Não coloque o autocomplete de menção em Server Action.** Server Actions são POSTs
> sequenciais e enfileirados — péssimos para busca-enquanto-digita. Use uma Route Handler
> `GET /api/mencoes?q=`. Server Actions para escrita, Route Handler para busca incremental.

### 3.2 Neon Postgres

- `pg_trgm` e full-text nativos → busca sem serviço externo.
- `jsonb` de primeira → conteúdo do editor.
- **Branching por preview deploy** — cada PR ganha um banco isolado. Com migrações frequentes,
  vale muito.

Driver: HTTP (`@neondatabase/serverless`) para leitura de página — uma requisição, sem pool, sem
cold start de conexão. O salvamento precisa de transação; o driver HTTP suporta transação em
lote (não interativa), suficiente aqui. WebSocket/Pool só se aparecer necessidade de transação
interativa — provavelmente nunca.

### 3.3 Drizzle (não Prisma)

- **Você vai escrever SQL de verdade:** coluna `tsvector` gerada, índice GIN com
  `gin_trgm_ops`, `ts_headline`, CTE recursiva para o grafo. Em Drizzle isso é ``sql`...` ``
  tipado e migrações `.sql` editáveis à mão. No Prisma, tsvector e trigram caem em `Unsupported`
  e migração manual de qualquer jeito — você paga o preço do ORM e não ganha a abstração.
- **Serverless:** sem engine binária, cold start desprezível.
- **Schema em TypeScript:** tipos de linha e tipos de domínio saem da mesma fonte, incluindo
  `$type<TiptapDoc>()` em colunas jsonb.

Custo aceito de olhos abertos: relational queries menos ergonômicas que `include` do Prisma,
`drizzle-kit studio` mais fraco que Prisma Studio, e erros de tipo ruins em queries complexas.

### 3.4 Tiptap (não Markdown puro)

A decisão mais consequente do projeto.

| Opção | Veredito | Por quê |
|---|---|---|
| **Tiptap** | **Escolhido** | `@tiptap/extension-mention` + utilitário `Suggestion` resolvem `@`, `/` e `#` com a mesma máquina. A menção vira um **nó atômico com atributos** — literalmente o requisito "referência armazenada estruturalmente". Schema estendível (nó `secret`, nó `event`). JSON direto pra `jsonb`. |
| Lexical | Rejeitado | Mais leve, mas você escreve plugin de menção, slash e serialização do zero. Ganha performance que não é o gargalo; perde semanas. |
| Editor.js | Rejeitado | Blocos sim, inline pobre — menção dentro de parágrafo é cidadão de segunda. Fluxo de teclado ruim. |
| Milkdown | Rejeitado | Também ProseMirror, mas Markdown como fonte da verdade — reintroduz o problema abaixo. |
| Markdown puro | **Rejeitado** | **O erro fatal.** Guardar `[[Lady Morgana]]` como texto significa que a identidade é o nome. Renomeou → quebrou tudo. É o defeito herdado do Obsidian, e o motivo dele existir (arquivos em disco) não se aplica aqui. |

> **Regra inegociável.** A menção guarda o **id** da entidade; o nome é apenas rótulo em cache:
> `{ type: "mention", attrs: { id: "uuid", label: "Lady Morgana" } }`. Renomear é um `UPDATE` em
> uma linha; o rótulo é atualizado na renderização, não no armazenamento.

**Gatilhos:** `@` entidade · `#` tag · `/` comandos de bloco · `Ctrl+K` navegação global.

`@` é gatilho único — um caractere sem Shift, funciona em teclado de celular, é o gesto que todo
mundo conhece. `[[` exige Shift duas vezes em ABNT e não traz vantagem. Sintaxe dupla vira
ambiguidade no parser e no dedo.

### 3.5 Better Auth

Motivo decisivo não é preço nem DX: **as tabelas de usuário ficam no seu banco.** Como tudo é
escopado por dono e, mais tarde, por membro de campanha, você quer `JOIN`, não uma chamada a
serviço externo para saber quem pode ler o quê. Um provedor OAuth (GitHub), sem e-mail, sem
magic link.

- **Clerk** — bom produto, mas identidade fora do banco e custo por MAU. Overkill declarado.
- **Auth.js v5** — funciona, mas continua desconfortável no App Router; mais cerimônia por menos.

### 3.6 Busca: dois mecanismos, dois problemas

| | Paleta `Ctrl+K` | Busca de conteúdo |
|---|---|---|
| Mecanismo | `pg_trgm` sobre `entities.name` | FTS sobre `tsvector` gerado |
| Consulta | GIN `gin_trgm_ops`, filtro `ILIKE` **ou** `<%`, ordem por `word_similarity()` | `websearch_to_tsquery('portuguese', …)`, `ts_rank`, `ts_headline` |
| Uso | 90% do uso real, precisa de <30 ms | "aquela cena da torre, não lembro a sessão" |

#### Não use o operador `%` no palette

Medido contra o banco real no PR 1:

| consulta | alvo | `similarity()` | `%` (limiar 0.3) | `<%` | `ILIKE` |
|---|---|---|---|---|---|
| `morg` | Lady Morgana | 0.29 | **falha** | ok (0.80) | ok |
| `rod` | Capitão Roderick | 0.17 | **falha** | ok (0.75) | ok |
| `alar` | Rei Alaric | 0.33 | ok | ok | ok |
| `sombras` | Ordem das Sombras | 0.47 | ok | ok | ok |

`similarity()` divide pelos trigramas da string **inteira**, então quanto mais longo o nome, mais
uma consulta curta é penalizada — e consulta curta é exatamente o que um command palette recebe.
`word_similarity()` compara a consulta com o melhor trecho de palavra dentro do nome e não sofre
disso.

A consulta do `Ctrl+K` fica:

```sql
SELECT id, name, type_key
FROM   entities
WHERE  campaign_id = $1 AND archived_at IS NULL
  AND  (name ILIKE '%' || $2 || '%' OR $2 <% name)
ORDER BY word_similarity($2, name) DESC, length(name), name
LIMIT 10;
```

`ILIKE` pega a subcadeia exata (o caso comum) e é acelerado pelo mesmo índice GIN
`gin_trgm_ops` a partir de 3 caracteres; `<%` cobre erro de digitação. Um índice, dois operadores.

Nomes próprios de fantasia não se beneficiam de stemming português — para nomes o trigram é quem
trabalha; o FTS serve à prosa. Por isso os dois.

**pgvector: não.** Centenas de entidades, não milhões. Embeddings custam chamada de API por
salvamento, latência, e resolvem um problema que `similarity()` + FTS cobrem nessa escala.
Reavaliar só se a busca literal falhar de forma perceptível.

### 3.7 Resto

| | | |
|---|---|---|
| Tailwind + shadcn/ui | sim | Precisa de `Command` (Ctrl+K), `Popover`, `Dialog`, `Combobox` acessíveis. Base UI por baixo (o shadcn atual migrou de Radix), código no repo. |
| Zod | sim | Fronteira de Server Actions e validação de `metadata` por tipo. Um schema por tipo, resolvido em runtime. |
| Estado cliente | RSC + URL | Filtros de timeline e busca em query params — deep-link e histórico do browser de graça. Zustand só se o editor precisar de estado global, e não precisa. |
| Testes | Vitest | Duas coisas de verdade: o extrator de menções e `stripSecrets()`. O resto é opcional. |
| Imagens | fase 3 | Não é caminho crítico. |

---

## 4. Modelo de domínio

### 4.1 O nó universal: `Entity`

Uma tabela genérica com `metadata jsonb`. Alternativas descartadas:

| Alternativa | Por que não |
|---|---|
| Uma tabela por tipo | Menções e relações viram FKs polimórficas contra N tabelas — sem integridade referencial e com `UNION` em toda consulta de backlink. Cada tipo novo é uma migração. Mata tipos definíveis pelo usuário. |
| EAV (linha por atributo) | O pior dos dois mundos: nem schema, nem consulta decente. `jsonb` é EAV com operadores e índice GIN. |
| Herança do Postgres | Não propaga índices nem FKs corretamente. Armadilha conhecida. |

**Tipo não é string solta.** Tipos são **dados**: tabela `entity_types` com
`{ key, label, plural, icon, color, fields }`, escopada por campanha, semeada com os padrões.
Entrega tipos definíveis pelo usuário sem migração, dá à UI o que renderizar, e é uma tabela só.
No MVP: crie a tabela, semeie, deixe `fields` como `[]` e renderize `metadata` num editor
genérico chave/valor. **Não construa um designer de schema na fase 1.**

**Dois eixos, uma tabela.** Personagem, Local, Item, Facção são *coisas do mundo*. Sessão, Ato,
Arco e Evento são *estrutura narrativa/temporal*. São diferentes, mas ambas precisam ser
mencionáveis, buscáveis, taggeáveis e relacionáveis — então ambas são `entities`. A diferença
vira uma flag (`is_narrative`) e, para dois casos, uma tabela de extensão.

### 4.2 Extensões 1:1 — só onde a consulta exige

Enfiar tudo em `metadata` custa ordenação indexada, unicidade e FK. Duas entidades sofrem e
ganham tabela de extensão (*class table inheritance*, PK = FK para `entities.id`):

- **`sessions`** — número (único por campanha, ordenável), data real, ato. O histórico de
  personagem ordena por número de sessão; isso não pode ser `jsonb->>'numero'` castado.
- **`events`** — posição na timeline, sessão de origem, local. A timeline é a consulta mais
  pesada do sistema.

**Atos e arcos ficam como entidades puras**, com `metadata.order`. São leves e não sustentam
consulta crítica. Promova no dia em que uma query doer — não antes.

### 4.3 `notes` não existe

**Toda entidade tem um corpo** (`content jsonb`), e "nota" é só uma entidade do tipo `nota`. O
texto da Sessão 05 é o corpo da entidade Sessão 05. Ganho: uma tabela a menos, um JOIN a menos,
um conceito a menos — e menções apontam sempre para o mesmo alvo, sem polimorfismo.

**Uma entidade = uma página = um documento.**

### 4.4 Sessão × Evento

- **Sessão** = fato do mundo real (aconteceu numa quinta, tem número, tem duração).
- **Evento** = fato da ficção (o rei morreu em 1045 DR).

Um evento é *registrado em* uma sessão mas *acontece em* outro tempo — inclusive antes da
campanha começar, o que cobre toda a história antiga do mundo.

Consequência de UX: eventos nascem **de dentro** do texto da sessão, via `/evento`, não em
formulário separado. O comando cria a entidade, liga à sessão atual e insere um nó no documento.

### 4.5 Relações

Uma linha, **sempre dirigida** `origem → destino`, com o rótulo inverso no tipo:

```ts
{ key: 'membro_de', label: 'membro de', inverse: 'tem como membro', symmetric: false }
{ key: 'aliado_de', label: 'aliado de', inverse: 'aliado de',       symmetric: true  }
{ key: 'matou',     label: 'matou',     inverse: 'foi morto por',   symmetric: false }
```

A página da Ordem das Sombras consulta `target_id = eu` e mostra "tem como membro: Lady
Morgana". **Nunca escreva duas linhas** — duplicação sempre dessincroniza. Tipos são dados na
mesma tabela, então relações customizadas saem de graça. `status`, `startsAt`, `endsAt`, `note`
e `isSecret` entram desde o começo: são baratos.

### 4.6 Tags: array, não tabela

`tags text[]` em `entities`, com índice GIN. Filtrar é `WHERE tags @> ARRAY['mistério']`.
Renomear é `UPDATE ... array_replace(...)`. Sem tabela `tags`, sem `entity_tags`, sem dois
JOINs. Promova para tabelas quando uma tag precisar de cor, descrição ou hierarquia —
provavelmente nunca.

---

## 5. Schema

### 5.1 Extensões e coluna de busca (migração SQL à mão)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE entities ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(summary, '')), 'B') ||
    setweight(jsonb_to_tsvector('portuguese', coalesce(content, '{}'::jsonb), '["string"]'), 'C')
  ) STORED;

CREATE INDEX entities_search_idx     ON entities USING gin(search_vector);
CREATE INDEX entities_name_trgm_idx  ON entities USING gin(name gin_trgm_ops);
CREATE INDEX entities_tags_idx       ON entities USING gin(tags);
```

`jsonb_to_tsvector` com filtro `'["string"]'` indexa só os valores string do documento — o
Postgres extrai o texto do JSON do Tiptap sozinho, sem coluna `content_text` paralela. O ruído é
pequeno (alguns atributos de nó entram no índice). Se incomodar, troque por `content_text`
preenchida no salvamento, com o mesmo `GENERATED` em cima dela.

### 5.2 `src/db/schema.ts`

```ts
import { pgTable, uuid, text, integer, boolean, date, bigint,
         jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ── campanha ────────────────────────────────────────
export const campaigns = pgTable('campaigns', {
  id:        uuid().primaryKey(),
  ownerId:   text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  worldId:   uuid(),                       // null hoje; gancho p/ mundo compartilhado
  name:      text().notNull(),
  slug:      text().notNull(),
  system:    text(),                       // "D&D 5e", "Fate"…
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex().on(t.ownerId, t.slug)]);

// ── tipos são dados, não enum ───────────────────────
export const entityTypes = pgTable('entity_types', {
  id:          uuid().primaryKey(),
  campaignId:  uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
  key:         text().notNull(),           // 'npc' | 'local' | 'faccao' | …
  label:       text().notNull(),
  plural:      text().notNull(),
  icon:        text(),
  color:       text(),
  isNarrative: boolean().default(false).notNull(),
  fields:      jsonb().$type<FieldDef[]>().default([]).notNull(),  // vazio no MVP
}, (t) => [uniqueIndex().on(t.campaignId, t.key)]);

// ── o nó universal ──────────────────────────────────
export const entities = pgTable('entities', {
  id:         uuid().primaryKey(),         // UUIDv7 gerado no CLIENTE — ver §6
  campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  typeKey:    text().notNull(),
  name:       text().notNull(),
  slug:       text().notNull(),
  summary:    text(),                      // 1 linha: hovercard, busca, cartão
  content:    jsonb().$type<TiptapDoc>(),  // corpo — FONTE DA VERDADE
  metadata:   jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  tags:       text().array().default([]).notNull(),
  status:     text(),                      // 'vivo' | 'morto' | … livre por tipo
  visibility: text().$type<Visibility>().default('mestre').notNull(),
  coverUrl:   text(),
  archivedAt: timestamp({ withTimezone: true }),   // soft delete — ver §6
  createdAt:  timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp({ withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex().on(t.campaignId, t.slug),
  index().on(t.campaignId, t.typeKey),
  index().on(t.campaignId, t.updatedAt),   // dashboard "recentes"
]);

// ── extensões 1:1, só onde a consulta exige ─────────
export const sessions = pgTable('sessions', {
  entityId:   uuid().primaryKey().references(() => entities.id, { onDelete: 'cascade' }),
  campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  number:     integer().notNull(),
  playedAt:   date(),
  actId:      uuid().references(() => entities.id, { onDelete: 'set null' }),
}, (t) => [uniqueIndex().on(t.campaignId, t.number)]);

export const events = pgTable('events', {
  entityId:     uuid().primaryKey().references(() => entities.id, { onDelete: 'cascade' }),
  campaignId:   uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  inWorldSort:  bigint({ mode: 'number' }),  // inteiro ordenável — ver §7.3
  inWorldLabel: text(),                      // "1045 DR, véspera de Lumina"
  sessionId:    uuid().references(() => sessions.entityId, { onDelete: 'set null' }),
  locationId:   uuid().references(() => entities.id, { onDelete: 'set null' }),
}, (t) => [index().on(t.campaignId, t.inWorldSort)]);

// ── menções: DERIVADAS, nunca escritas à mão ────────
export const mentions = pgTable('entity_mentions', {
  id:         uuid().primaryKey().defaultRandom(),
  campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sourceId:   uuid().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  targetId:   uuid().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  pos:        integer().notNull(),         // posição ProseMirror → "pular para"
  context:    text().notNull(),            // ~180 chars ao redor, p/ o backlink
  isSecret:   boolean().default(false).notNull(),
}, (t) => [
  uniqueIndex().on(t.sourceId, t.targetId, t.pos),
  index().on(t.targetId),                  // "onde aparece" — a consulta quente
]);

// ── relações: EXPLÍCITAS, escritas à mão ────────────
export const relationshipTypes = pgTable('relationship_types', {
  id:         uuid().primaryKey(),
  campaignId: uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
  key:        text().notNull(),
  label:      text().notNull(),
  inverse:    text().notNull(),
  symmetric:  boolean().default(false).notNull(),
});

export const relationships = pgTable('entity_relationships', {
  id:         uuid().primaryKey().defaultRandom(),
  campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sourceId:   uuid().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  targetId:   uuid().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  typeKey:    text().notNull(),
  status:     text(),
  startsAt:   bigint({ mode: 'number' }),  // mesma escala de inWorldSort
  endsAt:     bigint({ mode: 'number' }),
  note:       text(),
  isSecret:   boolean().default(false).notNull(),
}, (t) => [index().on(t.sourceId), index().on(t.targetId)]);

// ── caixa de entrada narrativa (fase 2) — DERIVADA ──
export const openThreads = pgTable('open_threads', {
  id:         uuid().primaryKey().defaultRandom(),
  campaignId: uuid().notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  sourceId:   uuid().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  pos:        integer().notNull(),
  text:       text().notNull(),
  resolved:   boolean().default(false).notNull(),
});
```

> **A regra que mantém o modelo íntegro: menção é derivada, relação é declarada.**
> Nunca edite `entity_mentions` à mão — ela é reconstruída a cada salvamento a partir do
> documento, e por isso nunca dessincroniza. `entity_relationships` é o oposto: só existe se
> você afirmou. Misturar as duas semânticas na mesma tabela é o erro que arruína modelos assim.

### 5.3 Tipos semeados

`entity_types` com `campaign_id NULL` são globais (herdados por toda campanha):

`pj` · `npc` · `local` · `cidade` · `regiao` · `reino` · `organizacao` · `faccao` · `item` ·
`criatura` · `missao` · `nota` · `segredo`
e os narrativos (`is_narrative = true`): `sessao` · `ato` · `arco` · `evento`.

O tipo genérico `personagem` foi descartado no PR 1: com `pj` e `npc` ao lado, ele vira uma
terceira opção ambígua bem no fluxo de "criar na hora", que é o caminho P0. Tipos são dados — se
fizer falta, é um `INSERT`.

---

## 6. Fluxo de referências

### 6.1 Escrita — o caminho de 400 ms

1. Você digita `@morg`. O plugin `Suggestion` do Tiptap intercepta e abre o popover no cursor.
2. `GET /api/mencoes?c=…&q=morg` — trigram em `entities.name`, limite 8, debounce 120 ms.
   **Cacheie o conjunto completo de nomes da campanha no cliente na primeira carga e filtre
   localmente.** Uma campanha tem centenas de entidades, não milhares — cabe em memória e elimina
   a latência de rede. A requisição vira fallback, não caminho principal.
3. Existe → `Enter` insere o nó `{ type:'mention', attrs:{ id, label } }`.
4. Não existe → a última linha do popover é **"Criar «Roderick» como…"** com os tipos, navegáveis
   por seta ou atalho de letra.
5. **O truque que faz isso ser instantâneo:** o id é um **UUIDv7 gerado no cliente**. O nó é
   inserido imediatamente com esse id; o `INSERT` vai numa Server Action em segundo plano. Sem
   round-trip no meio da digitação, sem id temporário, sem reconciliação.
6. Você continua escrevendo. A entidade nasceu com nome e tipo — que é uma entidade válida.

### 6.2 Salvamento — derivação

Autosave com debounce de ~1,5 s, mais snapshot em `localStorage` a cada alteração.

```ts
async function salvarDocumento(entityId: string, doc: TiptapDoc) {
  const mencoes = extrairMencoes(doc);   // caminha a árvore uma vez
  const tags    = extrairTags(doc);
  const ganchos = extrairPendencias(doc); // taskItems não marcados (fase 2)

  await db.transaction(async (tx) => {
    await tx.update(entities)
      .set({ content: doc, tags, updatedAt: new Date() })
      .where(eq(entities.id, entityId));

    // apaga-e-reinsere: idempotente, sem diff, sem drift
    await tx.delete(mentions).where(eq(mentions.sourceId, entityId));
    if (mencoes.length) await tx.insert(mentions).values(mencoes);
  });
}
```

Apagar e reinserir em vez de fazer diff é deliberado: são dezenas de linhas por documento, a
transação é trivial, e o estado derivado passa a ser **função pura do documento**. Nunca há
divergência para depurar.

Cada menção captura seu `context` no momento da derivação — é o que permite renderizar "Onde
aparece" com uma consulta só, sem carregar e reparsear todos os documentos de origem. E como é
reescrito a cada salvamento, nunca envelhece.

### 6.3 Leitura — a página da entidade

```sql
SELECT e.id, e.name, e.type_key, m.context, m.pos, s.number AS sessao
FROM   entity_mentions m
JOIN   entities e ON e.id = m.source_id
LEFT JOIN sessions s ON s.entity_id = m.source_id
WHERE  m.target_id = $1 AND (NOT m.is_secret OR $2)   -- $2 = é o mestre
ORDER BY s.number NULLS LAST, e.created_at;
```

O `ORDER BY s.number` faz o histórico da Lady Morgana sair como *Sessão 01, 03, 05, 08* — ordem
da ficção, não de edição. É o join com a tabela de extensão pagando por si mesmo.

A página agrupa por tipo da origem: menções vindas de sessões viram **Histórico**; as demais
viram **Aparece em**. Mesma tabela, duas apresentações.

### 6.4 Renomear

`UPDATE entities SET name = …`. Nada mais. Os documentos guardam ids; o `label` no nó é cache de
exibição, revalidado na renderização — se divergir, o banco vence. **Esta é a razão inteira de
não guardar Markdown.**

### 6.5 Apagar

Apagar uma entidade mencionada deixaria nós órfãos no meio de textos. **Não faça hard delete:**
`archived_at`, esconde das listas e da busca, e a menção órfã renderiza em estado neutro. Sem
cascata destrutiva sobre prosa que você escreveu.

---

## 7. Arquitetura de conteúdo

Prosa livre e dados estruturados na mesma superfície. A chave: **a prosa é sempre a fonte da
verdade; o estruturado é ou uma projeção dela, ou uma anotação sobre ela.**

| Camada | O que é |
|---|---|
| `content` (jsonb) | Documento Tiptap. Fonte da verdade. Nunca gerado, sempre escrito. Contém os nós de menção, tag, tarefa e segredo. |
| `metadata` (jsonb) | Campos por tipo, validados com Zod. Opcionais. Painel lateral que **nunca** bloqueia a escrita. |
| Colunas e extensões | Só o que participa de `WHERE`, `ORDER BY` ou `UNIQUE`. |

**Regra de promoção:** nasce em `metadata`. No momento em que você escrever uma query que filtra
ou ordena por aquele campo, promova para coluna e migre. Mantém o schema pequeno e sempre
justificado, sem travar a evolução dos tipos.

### 7.1 Segredos: um nó, não uma coluna

"Lady Morgana é irmã do Rei Alaric" marcado como `GM ONLY` é **visibilidade por trecho**, não
por página. Logo:

- Um nó `secret` no schema do Tiptap, aplicável a qualquer bloco. Fundo diferenciado no modo
  mestre.
- `stripSecrets(doc)` remove esses nós **no servidor**, antes de serializar para leitor
  não-mestre. **Nunca esconda com CSS** — o conteúdo estaria no HTML.
- Menções dentro de um nó secreto derivam com `is_secret = true`, para o backlink não vazar na
  página da entidade mencionada. É a fuga de informação menos óbvia e mais provável do modelo.
- `entities.visibility` cobre o caso grosso: página inteira oculta.

No MVP: construa o nó, a coluna e a flag; construa `stripSecrets()` e **teste-a**. Não construa
portal de jogador. Custo: uma tarde, e você nunca mais migra dados para isso.

### 7.2 Tempo interno: ordene, não calcule

> **A armadilha do calendário.** É aqui que projetos assim morrem: alguém decide suportar
> calendários customizados — meses de 40 dias, três luas, anos bissextos élficos — e passa dois
> meses num motor de datas em vez de na wiki.

**Não construa calendário.** Guarde:

- `in_world_sort` — inteiro grande, ordenável, que você trata como quiser (ano×10000+dia, ou só
  uma ordem arbitrária).
- `in_world_label` — texto livre para exibição: "1045 DR, véspera de Lumina".

Ordenação funciona, exibição é livre, código de calendário é zero linhas. Se um dia quiser
aritmética de datas, o `sort` já é a representação canônica e um parser vira por cima. Caminho
de evolução aberto, custo hoje: nenhum.

### 7.3 Timeline e participação

`SELECT ... FROM events ORDER BY in_world_sort`, com dois filtros úteis: por tipo de origem e
**por entidade** — este via `JOIN entity_mentions ON target_id = $entidade`. Ou seja: quem é
mencionado num evento *é* participante dele, sem tabela de participantes.

Simplificação consciente, com limite conhecido: menção e participação não são a mesma coisa
("o assassinato ocorreu longe de @Valoria"). Quando incomodar, promova a menção a uma
`relationship` explícita (`participou_de`) com um clique no backlink. **Não antecipe.**

---

## 8. Estrutura do repositório

**Uma camada de domínio, e Server Actions coladas na rota que as usa.** Sem
`server/services` + `server/actions` + `lib/entities` — três lugares plausíveis para "criar uma
entidade" é a camada artificial a evitar. Sem `types/` global: tipos de linha saem do
`$inferSelect` do Drizzle, o resto mora junto do módulo dono.

```
src/
├── app/
│   ├── (auth)/entrar/
│   ├── (app)/
│   │   ├── layout.tsx                  // shell + paleta Ctrl+K
│   │   ├── page.tsx                    // lista de campanhas
│   │   └── c/[campanha]/
│   │       ├── page.tsx                // dashboard
│   │       ├── actions.ts              // Server Actions desta área
│   │       ├── e/[slug]/page.tsx       // QUALQUER entidade, um template só
│   │       ├── sessoes/page.tsx
│   │       ├── linha-do-tempo/page.tsx
│   │       └── busca/page.tsx
│   └── api/
│       └── mencoes/route.ts            // GET, autocomplete (não é action)
│
├── db/
│   ├── schema.ts
│   ├── index.ts                        // cliente Neon
│   ├── seed.ts                         // entity_types + relationship_types padrão
│   └── migrations/                     // .sql versionado, editável à mão
│
├── domain/                             // ÚNICA camada de lógica
│   ├── entities.ts                     // criar, renomear, arquivar, slug
│   ├── documents.ts                    // salvar + derivar menções/tags/ganchos
│   ├── mentions.ts                     // backlinks, histórico ordenado
│   ├── relationships.ts
│   ├── search.ts                       // trigram + FTS
│   ├── timeline.ts
│   └── visibility.ts                   // stripSecrets + escopo do leitor
│
├── editor/
│   ├── schema.ts                       // extensões Tiptap
│   ├── mention.ts                      // @ + criar-na-hora
│   ├── slash.ts                        // / comandos
│   ├── secret.ts                       // nó GM-only
│   ├── extract.ts                      // JSON → menções, tags, pendências
│   └── Editor.tsx
│
├── components/
│   ├── ui/                             // shadcn, gerado
│   └── …                               // plano até doer; subpastas depois
│
├── auth.ts
└── lib/utils.ts
```

Três decisões que valem defender:

- **Uma rota `e/[slug]` para toda entidade.** O tipo escolhe quais painéis renderizar, não qual
  rota. Adicionar o tipo "Divindade" não cria arquivo nenhum — é o teste real de que
  tipos-como-dados funciona.
- **`editor/` no topo, fora de `components/`.** É o coração do produto e mistura schema, plugins
  e extração — merece ser um domínio, não uma pasta de componentes.
- **`extract.ts` é código puro e testável.** JSON entra, menções saem. É a única lógica que,
  quebrando em silêncio, corrompe dados. Testes de unidade aqui já pagam a conta.

Rotas e conteúdo em pt-BR, identificadores em inglês.

---

## 9. Roadmap

Detalhe executável da Fase 0 em [FASE-0.md](FASE-0.md).

| Fase | Escopo | Sai da fase quando |
|---|---|---|
| **0 — o núcleo** | Editor + menção + backlink + sessões + Ctrl+K | você mestrou **três sessões inteiras** dentro do app sem abrir outro editor |
| **1 — estrutura** | Atos, arcos, eventos via `/evento`, tags `#`, FTS, painel de `metadata`, nó `secret` + `stripSecrets()` | você consegue reconstruir a história de uma campanha lendo só o app |
| **2 — conexão** | Timeline filtrável, relações explícitas, dashboard, caixa narrativa (`open_threads`) | o dashboard responde "onde eu estava?" sem você caçar |
| **3 — visualização** | Grafo, mapas, portal de leitura para jogadores | — |

### Fase 3, detalhes já decididos

- **Grafo: Cytoscape.js + layout `fcose`.** React Flow é feito para *editores* de nós — ótimo
  para arrastar e conectar à mão, sem layout automático de força (precisa dagre/elk por fora) e
  sem algoritmos de grafo. Sigma.js só ganha acima de ~5.000 nós, que uma campanha nunca terá.
  Cytoscape é o único dos três que é biblioteca de grafos de verdade nessa escala.
  *Com franqueza: o grafo é a feature mais fotogênica e uma das menos úteis. Um painel de
  relações bem feito e uma boa lista de backlinks respondem as mesmas perguntas com mais
  precisão. Schema já está pronto (`relationships` + `mentions` são as arestas) — construa por
  último e sem ansiedade.*
- **Mapas:** imagem + pins em coordenadas relativas, cada pin com `entity_id`. Não precisa de
  Leaflet no começo — `<img>` com pins absolutos e zoom por CSS resolve. Leaflet com
  `CRS.Simple` só quando quiser camadas e zoom real.
- **Portal de jogador:** rota pública por token de campanha, servindo entidades
  `publico`/`revelado` com `stripSecrets()`. Somente leitura, sem login para o jogador.

### Rejeitados por padrão

Colaboração em tempo real · IA generativa de conteúdo · fichas com regras de sistema ·
importadores de outras ferramentas · app móvel nativo · calendários customizados.

Cada um é um produto inteiro. Só entram se a falta doer três vezes.

---

## 10. Riscos

| # | Risco | Probabilidade | Impacto | Mitigação | Quando |
|---|---|---|---|---|---|
| R1 | **Latência no autocomplete de `@`** mata o fluxo de escrita e você volta pro Obsidian | Alta | Fatal | Cachear todos os nomes da campanha no cliente na carga da campanha e filtrar localmente; rede vira fallback. Orçamento: **popover aberto em <50 ms**. | Fase 0, PR 4 |
| R2 | **Perda de anotação de sessão** — três horas de texto perdidas por uma aba fechada | Média | Fatal | Autosave com debounce 1,5 s **+** snapshot em `localStorage` a cada alteração **+** recuperação na abertura. Não é otimização prematura; é a única coisa que não pode falhar. | Fase 0, PR 3 |
| R3 | **Vazamento de segredo por backlink** — a página do jogador esconde o parágrafo, mas a página do NPC lista o `context` extraído dele | Média | Alto | `is_secret` propagado na derivação da menção + `stripSecrets()` **com teste unitário**. Filtro no `WHERE` da consulta de backlink, não na renderização. | Fase 1 |
| R4 | **Pântano do `metadata`** — empilhar campo até virar um World Anvil caseiro com 30 campos vazios | Alta | Médio | Só adicione campo quando ele já estiver preenchido à mão em cinco entidades. Regra de promoção do §7. | Contínuo |
| R5 | **Construir tudo antes de usar** — o maior risco do projeto | Alta | Alto | Fase 0 tem 7 itens e um critério de saída baseado em uso real, não em features. Se você chegar na mesa com o editor funcionando e nada mais, já ganhou. | Fase 0 |
| R6 | **Cold start do Neon** (autosuspend) faz a primeira consulta da noite demorar | Certa | Baixo | Aceitar. Se incomodar: `fetch` de aquecimento no login. Não pague por "always on" antes de sentir. | — |
| R7 | **Extensão paga do Tiptap** entrar por acidente no caminho crítico | Média | Médio | O núcleo (`StarterKit`, `Mention`, `Suggestion`, `TaskList`) é livre. O nó `secret` é **custom, escrito por nós** — não use `Details` (Pro). Ver [CUSTO-ZERO.md](CUSTO-ZERO.md). | Fase 0, PR 3 |
| R8 | **`jsonb_to_tsvector` indexar ruído** (ids, urls, nomes de atributo) e sujar o ranking | Média | Baixo | Aceitar no começo. Se o ranking piorar, trocar por coluna `content_text` derivada no salvamento — mesma migração, uma linha de código a mais. | Fase 1 |
| R9 | **Vercel Hobby é não-comercial.** Se um dia virar produto pago, precisa migrar para Pro | Baixa | Baixo | Nada a fazer hoje. Registrado para não ser surpresa. | — |

---

## Apêndice — decisões que já foram tomadas e não devem ser reabertas sem motivo novo

1. A menção guarda **id**, não nome.
2. Menção é **derivada**; relação é **declarada**.
3. Uma tabela `entities`; `notes` não existe.
4. `@` é o gatilho único de entidade.
5. Sem motor de calendário: `in_world_sort` + `in_world_label`.
6. Sem pgvector, sem Redis, sem filas, sem tempo real.
7. Um `domain/`, sem camada de "services".
8. Fase 0 termina por **uso real**, não por checklist de features.
