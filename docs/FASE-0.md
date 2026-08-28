# Fase 0 — o núcleo

> **Objetivo único: mestrar uma sessão real dentro do app.**
>
> Critério de saída: **três sessões inteiras conduzidas no Grimório, sem abrir outro editor.**
> Não é uma lista de features concluídas — é uso real. Enquanto isso não acontecer, nenhuma
> feature da Fase 1 começa.

Contexto e justificativa das decisões: [ARQUITETURA.md](ARQUITETURA.md).

---

## Escopo

Dentro:

- Auth com um provedor OAuth
- Campanha: criar, listar, abrir
- Editor Tiptap com `@` → autocomplete → criar-na-hora
- `entities` + `entity_mentions`, derivação no salvamento
- Página de entidade: corpo + "Onde aparece"
- Sessões (número, data, corpo)
- `Ctrl+K` por nome (trigram)

Fora — **explicitamente adiado**, mesmo que pareça fácil:

atos · arcos · eventos · tags · timeline · dashboard · relações explícitas · segredos ·
grafo · mapas · portal de jogador · painel de `metadata` · busca full-text · upload de imagem.

> A hipótese arriscada do projeto é a ergonomia do editor, e ela só se valida numa mesa. Tudo o
> que for construído em volta antes dessa validação pode ter que mudar.

---

## Pré-requisitos

| Item | Como |
|---|---|
| Repositório no GitHub | `grimorio`, privado |
| Projeto na Vercel | importar o repo; framework Next.js detectado automaticamente |
| Banco Neon | Marketplace da Vercel → Neon → plano Free. Injeta `DATABASE_URL` nos 3 ambientes |
| GitHub OAuth App | Settings → Developer settings → OAuth Apps. Callback: `http://localhost:3100/api/auth/callback/github` e o equivalente em produção |

### `.env.local`

```bash
DATABASE_URL=postgres://…              # do Neon (a integração Vercel preenche em prod)
BETTER_AUTH_SECRET=…                   # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3100
GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…
```

### Porta

Vários projetos deste workspace disputam a 3000. **Suba na 3100**
(`npx next dev -p 3100`) e ajuste `BETTER_AUTH_URL` e o callback do OAuth de acordo.
Quem sobe o servidor é quem mata — ver o `CLAUDE.md` da raiz do workspace.

---

## Sequência de PRs

Cada PR é mergeável sozinho e tem um critério de pronto verificável. Um branch por PR, nada
direto na `main`.

### PR 0 — esqueleto  ✅ concluído

```bash
npx create-next-app@latest . --yes --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm
npx shadcn@latest init -d -y
npx shadcn@latest add button dialog command popover input -y
npm i drizzle-orm @neondatabase/serverless zod
npm i -D drizzle-kit vitest
```

O que o `@latest` realmente instalou (ago/2026), diferente do que este plano assumia:

| | Assumido | Instalado |
|---|---|---|
| Next | 15 | **16.3.3** (Turbopack por padrão) |
| React | 19 | 19.2.8 |
| Tailwind | 3 | **4** |
| Primitivas do shadcn | Radix | **Base UI** (`@base-ui/react`) |
| Zod | 3 | **4.5** |

Nada disso muda a arquitetura — registrado em ARQUITETURA.md §3.1.

Entregue:

- `src/db/index.ts` — cliente Neon HTTP com `casing: 'snake_case'` e erro explícito se
  `DATABASE_URL` faltar
- `src/db/schema.ts` — placeholder; o schema real é o PR 1
- `drizzle.config.ts` — carrega `.env.local` via `process.loadEnvFile` (nativo do Node, sem
  `dotenv`), `casing: 'snake_case'`, saída em `src/db/migrations`
- `.env.example` com as cinco variáveis (`DATABASE_URL` + as quatro do PR 2)
- Scripts: `dev` (**porta 3100**), `build`, `start`, `lint`, `typecheck`, `test`,
  `db:generate`, `db:migrate`, `db:studio`, `seed`
- Página placeholder e `metadata` em pt-BR; assets de exemplo do template removidos
- `shadcn` movido para `devDependencies` (é CLI, não runtime)

Decisões pequenas tomadas aqui:

- **`casing: 'snake_case'` nos dois lugares** (`drizzle.config.ts` e `src/db/index.ts`). É o que
  permite o schema de ARQUITETURA.md §5.2 declarar `campaignId` sem nomear coluna. Os dois
  precisam ficar em sincronia — anotado no `CLAUDE.md`.
- **Sem `dotenv` e sem `tsx`.** `process.loadEnvFile` e o type stripping nativo do Node 24 cobrem
  os dois casos com zero dependência.
- **`test` roda com `--passWithNoTests`** para não falhar antes do PR 5.
- **`!.env.example` no `.gitignore`** — o template gerado ignora `.env*` inteiro.

**Verificado:** `typecheck`, `lint`, `test` e `build` passam; o build gera `/` estaticamente.
**Falta:** repositório no GitHub, projeto na Vercel e banco Neon — dependem das suas credenciais.

### PR 1 — schema e migrações

- `src/db/schema.ts` conforme §5.2 da arquitetura — **todas** as tabelas, inclusive as que a
  Fase 0 não usa (`relationships`, `events`, `open_threads`). Criar o schema completo agora é
  mais barato que migrar depois, e não custa código de aplicação.
- Migração SQL à mão para `pg_trgm`, coluna gerada `search_vector` e os três índices GIN (§5.1).
- `src/db/seed.ts`: `entity_types` e `relationship_types` globais (§5.3).

**Pronto quando:** `npm run db:migrate && npm run seed` roda limpo num branch Neon novo, e
`SELECT * FROM entity_types` traz os tipos padrão.

### PR 2 — auth e campanhas

```bash
npm i better-auth
```

- `src/auth.ts` com adapter Drizzle e provedor GitHub
- Rota `(auth)/entrar` e proteção do grupo `(app)`
- `domain/campaigns.ts`: criar, listar por dono, buscar por slug
- Páginas: lista de campanhas e criação (um `Dialog` com nome + sistema)

**Pronto quando:** você entra com GitHub, cria a campanha "Sombras de Valoria" e ela aparece na
lista após um F5.

### PR 3 — editor e salvamento

```bash
npm i @tiptap/react @tiptap/pm @tiptap/starter-kit \
      @tiptap/extension-placeholder @tiptap/extension-task-list @tiptap/extension-task-item
```

- `src/editor/Editor.tsx` — Tiptap controlado, sem menção ainda
- `domain/documents.ts` — `salvarDocumento()` (sem derivação por enquanto)
- Autosave: debounce 1,5 s **+ snapshot em `localStorage` a cada alteração + recuperação na
  abertura**. Isto é do PR 3, não "depois" — é o risco R2.
- Página de entidade em `c/[campanha]/e/[slug]`, renderizando o corpo

**Pronto quando:** você escreve um parágrafo, fecha a aba no meio da digitação, reabre e o texto
está lá. Teste isso de verdade, com a aba fechada mesmo.

### PR 4 — a menção `@` ⭐

O PR que define o projeto. Vale gastar tempo aqui.

```bash
npm i @tiptap/extension-mention uuidv7
```

- `src/editor/mention.ts` — `Mention` + `Suggestion` com gatilho `@`
- Popover: lista de resultados + última linha **"Criar «X» como…"** com os tipos
- **Cache local:** carregar todos os `{ id, name, typeKey }` da campanha na entrada e filtrar em
  memória. `GET /api/mencoes` existe como fallback e para campanhas grandes.
- **UUIDv7 no cliente:** o nó entra com id real na hora; o `INSERT` da entidade vai numa Server
  Action em segundo plano.

**Pronto quando:** digitando `@Roderick` num texto novo, você cria o NPC e continua a frase
**sem tirar a mão do teclado e sem esperar carregamento visível.** Meça: popover aberto em
< 50 ms.

### PR 5 — derivação e backlinks

- `src/editor/extract.ts` — caminha o JSON e retorna as menções com `pos`, `context` e
  `isSecret`. **Código puro.**
- `src/editor/extract.test.ts` — Vitest. Casos mínimos: documento vazio, menção solta, menção
  repetida, menção dentro de lista, `context` truncado nas bordas.
- `salvarDocumento()` ganha a transação apaga-e-reinsere (§6.2)
- `domain/mentions.ts` — consulta de backlinks (§6.3)
- Seção "Onde aparece" na página da entidade

**Pronto quando:** mencionar a Morgana em dois textos faz os dois aparecerem na página dela, com
o trecho de contexto correto; e apagar uma menção do texto a remove da lista no salvamento
seguinte.

### PR 6 — sessões

- Extensão `sessions` em uso: número (auto-incremento por campanha), data real, ato ainda nulo
- Criar sessão a partir da campanha, com o corpo já em foco no editor
- Lista de sessões
- Backlinks vindos de sessões agrupados como **Histórico**, ordenados por `s.number` (§6.3)

**Pronto quando:** a página da Lady Morgana mostra "Sessão 01 / Sessão 03 / Sessão 05" nessa
ordem, e não em ordem de edição.

### PR 7 — `Ctrl+K`

- `Command` do shadcn em dialog global
- `domain/search.ts` — trigram sobre `entities.name`, `similarity()`, limite 10
- Navegação por teclado e Enter para abrir

**Pronto quando:** `Ctrl+K` + `morg` acha a Lady Morgana em menos de um segundo, de qualquer
página.

---

## Depois do PR 7: parar

Mestre três sessões. Anote no próprio app o que atrapalhou.

Perguntas a responder com uso real, antes de qualquer código da Fase 1:

- O `@` interrompe o pensamento ou desaparece no fluxo?
- Criar entidade na hora funciona, ou você acaba criando tudo depois?
- Os backlinks são consultados de verdade, ou você navega por busca?
- O que você tentou fazer e o app não deixou?

**A resposta a essas quatro perguntas vale mais que este documento inteiro.**

---

## Invariantes — não quebrar sem discussão

1. A menção guarda **id**, nunca nome.
2. `entity_mentions` é **derivada**: reconstruída no salvamento, nunca editada à mão.
3. Nada bloqueia a escrita. Entidade válida é `{ nome, tipo }`.
4. `extract.ts` é puro e testado.
5. Nenhuma extensão paga do Tiptap entra (ver [CUSTO-ZERO.md](CUSTO-ZERO.md)).
6. Sem hard delete de entidade — `archivedAt`.
7. Autosave + `localStorage` nunca saem do caminho.
