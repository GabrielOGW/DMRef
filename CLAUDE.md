# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What this is

**Grimório** — a personal, connected-knowledge wiki for tabletop RPG campaigns. The thesis:
structure is *derived from writing*, never entered in forms. The GM writes the session notes;
the system extracts who appeared, where, and what happened.

**Status: PR 2 in review** — scaffold, full schema + migrations + seed, GitHub auth and
campaigns (create, list, open). Auth is code-complete but unproven end to end: the GitHub OAuth
App does not exist yet, so `GITHUB_CLIENT_ID`/`SECRET` are placeholders. Next up: PR 3 (Tiptap
editor + autosave) in docs/FASE-0.md.

Read before working here:

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — **authoritative.** Product vision, benchmark,
  stack decisions with rationale, domain model, full DB schema, reference flow, content
  architecture, repo layout, roadmap, risk register.
- [docs/FASE-0.md](docs/FASE-0.md) — the executable plan: PR sequence with done-criteria.
  This is what to build next.
- [docs/CUSTO-ZERO.md](docs/CUSTO-ZERO.md) — the free-tier stack and its limits.

## Invariants

These are settled decisions. Do not violate them; if a task seems to require it, stop and say so.

1. **A mention stores the entity `id`, never the name.** `{ type: 'mention', attrs: { id, label } }`.
   `label` is a display cache. This is why the content is Tiptap JSON and not Markdown — renaming
   an entity must be a one-row `UPDATE`.
2. **Mentions are derived; relationships are declared.** `entity_mentions` is rebuilt from the
   document on every save (delete-and-reinsert, in one transaction) and must never be hand-edited.
   `entity_relationships` only exists when the user asserts it. Never mix the two semantics.
3. **One `entities` table.** There is no `notes` table — a note is an entity of type `nota`.
   Every entity has one body (`content jsonb`). One entity = one page = one document.
4. **Nothing blocks writing.** A valid entity is `{ name, type }`. Never require a field, never
   open a form the user did not ask for.
5. **Entity types are data**, rows in `entity_types` — not a TS union, not a Postgres enum.
   Adding a type must not require a migration or a new route.
6. **No calendar engine.** In-world time is `in_world_sort` (sortable bigint) +
   `in_world_label` (free text). Do not build date arithmetic.
7. **Secrets are stripped server-side.** `stripSecrets(doc)` runs before serializing for a
   non-GM reader. Never hide with CSS. Mentions inside a secret node carry `is_secret = true`
   so backlinks don't leak.
8. **No hard delete of entities** — `archivedAt`, so mention nodes never dangle.
9. **Autosave + `localStorage` snapshot are non-negotiable.** Losing session notes kills the
   product.
10. **No paid Tiptap extensions.** The `secret` node is custom-written; do not reach for
    `Details` or `UniqueID`. See CUSTO-ZERO.md.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui
(Base UI primitives) · Neon Postgres (HTTP driver) · Drizzle · Tiptap · Better Auth (GitHub
OAuth) · Zod 4 · Vitest.

Deliberately absent: pgvector, Redis, queues, realtime/CRDT, state libraries, service layer.

## Architecture in one paragraph

`src/app/` holds thin routes (Server Components) with Server Actions colocated in the route
group that uses them. `src/domain/` is the **only** logic layer — no `services/`, no
`repositories/`. `src/editor/` is a first-class domain (Tiptap schema, mention/slash plugins,
and `extract.ts`), not a components folder. `src/db/` holds the Drizzle schema and hand-editable
SQL migrations. One route, `c/[campanha]/e/[slug]`, renders every entity type — the type picks
which panels render, not which file exists.

`src/editor/extract.ts` is the only place where silent breakage corrupts data. It is pure
(JSON in, mentions out) and must stay tested.

## Commands

`dev` (port 3100) · `build` · `start` · `lint` · `typecheck` · `test` (Vitest,
`--passWithNoTests`) · `db:generate` · `db:migrate` · `db:studio` · `seed`.

The drizzle-kit scripts need no env prefix: `drizzle.config.ts` loads `.env.local` itself via
`process.loadEnvFile`. `seed` relies on Node 24 native type stripping — no tsx, no ts-node.

**Port:** several projects in this workspace fight over 3000, so `dev` is pinned to 3100.
Whoever starts a dev server kills it — see the workspace root `CLAUDE.md`.

## Next 16 — read the shipped docs first

`AGENTS.md` (generated and re-added by `next dev`) warns that this Next version has breaking
changes versus most training data. Before writing routing, caching, Server Action or config
code, read the relevant guide in `node_modules/next/dist/docs/`. Do not assume Next 14/15
conventions.

## Conventions

- **Language:** all user-facing content, routes, docs, commits and test descriptions in
  **pt-BR**. Code identifiers in English. `CLAUDE.md` files in English.
- **Git:** feature branch + PR for everything. **Never commit to `main`.**
- **Search:** two mechanisms, two purposes — `pg_trgm` on `entities.name` for the Ctrl+K palette,
  Postgres FTS on the generated `search_vector` for content. Don't merge them.
- **Data access:** Neon HTTP driver for reads; batched transaction for the save-and-derive path.
- **Auth:** `src/auth.ts` owns the Better Auth instance plus `sessaoAtual()` and
  `exigirUsuario()`. Every Server Action starts with `exigirUsuario()` and every query scopes by
  `ownerId` — the `(app)` layout gate is UI convenience, not a security boundary. Sign-in and
  sign-out are Server Actions; there is deliberately no `createAuthClient` yet.
- **`session` vs `sessions`:** the singular table is a login session (the name Better Auth's
  adapter looks for — never rename it); the plural is a table session. Same file.
- **Column casing:** declare columns in camelCase and let Drizzle map to snake_case
  (`casing: 'snake_case'`, set in both `drizzle.config.ts` and `src/db/index.ts`). Never name
  columns by hand — the two configs must stay in sync.
