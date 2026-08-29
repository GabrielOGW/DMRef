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

## Pendências de infraestrutura

Decidido em 2026-08-28, ao conferir o ambiente. Nada disso bloqueia a Fase 0.

| # | Pendência | Decisão | Quando resolver |
|---|---|---|---|
| I1 | **Proteção de deployment (SSO da Vercel) ligada em todas as URLs `*.vercel.app`.** Só o dono da conta abre o site. | **Manter por enquanto** — o app é do mestre e ninguém mais precisa entrar. | **Obrigatório antes do portal do jogador** (fase 3): o portal é uma rota pública por token e não funciona sob SSO. Adiado, não cancelado. |
| I2 | **Região das functions** deve ser `gru1` (São Paulo) para casar com o banco em `sa-east-1`. O padrão do Hobby é `iad1`, e cada consulta atravessaria o continente. | Configurado como `gru1`; não deu para confirmar pela API. | Conferir em Settings → Functions quando a primeira consulta ao banco existir (PR 2). Se estiver em `iad1`, trocar — o orçamento do `Ctrl+K` é 30 ms. |
| I3 | **Nome do projeto.** O repositório é `DMRef`; o produto ainda se chama Grimório (pasta local, `package.json`, título). | Segue como Grimório até decisão contrária — repositório é endereço, não marca. | A qualquer momento; quanto antes, menos lugares. |

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

### PR 1 — schema e migrações  ✅ concluído

- `src/db/schema.ts` — as 9 tabelas de ARQUITETURA.md §5.2, inclusive as que a Fase 0 não usa
  (`entity_relationships`, `events`, `open_threads`). Criar o schema completo agora é mais barato
  que migrar depois e não custa código de aplicação.
- `src/db/migrations/0000_inicial.sql` — gerado pelo drizzle-kit, com
  `CREATE EXTENSION IF NOT EXISTS pg_trgm` acrescentado à mão no topo (precisa existir antes do
  índice `entities_name_trgm_idx`).
- `src/db/seed.ts` — 17 tipos de entidade e 11 tipos de relação globais.

**Aplicado e verificado no Neon:** 9 tabelas, `pg_trgm` instalada, `search_vector` `GENERATED
ALWAYS … STORED`, seed idempotente (segunda execução insere 0), e uma prova ponta a ponta
(campanha + entidade descartáveis) confirmando que o FTS acha texto **dentro do JSON do Tiptap**
e no `summary`.

Três desvios do plano original, todos deliberados:

1. **`campaigns.ownerId` é `text` sem FK.** Quem define a tabela de usuários é o Better Auth,
   pela CLI dele, no PR 2 — adivinhar o schema aqui só criaria uma migração de conserto. A FK
   entra no PR 2.
2. **`nullsNotDistinct()` não existe nesta versão do Drizzle.** Sem ele, `(NULL, 'npc')` nunca
   colide com `(NULL, 'npc')` e o seed duplicaria os tipos globais a cada execução. Resolvido com
   um índice único **parcial** (`... ON (key) WHERE campaign_id IS NULL`), que dá a mesma
   garantia e é expressável no schema.
3. **O tipo genérico `personagem` foi descartado** — ver ARQUITETURA.md §5.3.

E uma correção de projeto, medida contra o banco: **o operador `%` do pg_trgm não serve para o
palette** (falha em `morg` → Lady Morgana e `rod` → Capitão Roderick, que são exatamente o tipo
de consulta que o `Ctrl+K` recebe). A consulta correta usa `ILIKE`/`<%` com ordem por
`word_similarity()`. Tabela com os números em ARQUITETURA.md §3.6 — **ler antes do PR 7.**

Detalhe de execução: o `seed` roda por type stripping do Node, que é ESM e exige extensão
explícita no import. Por isso `src/db/index.ts` importa `./schema.ts` e o `tsconfig.json` ganhou
`allowImportingTsExtensions`.

### PR 2 — auth e campanhas  ⏳ codigo pronto, falta a credencial do GitHub

```bash
npm i better-auth   # 1.7.2
```

Entregue:

- `src/auth.ts` — `betterAuth` com `drizzleAdapter`, provedor GitHub e o plugin `nextCookies()`
  (último da lista, é o que deixa a Server Action gravar o cookie de sessão). Mais dois
  helpers: `sessaoAtual()` e `exigirUsuario()`, que redireciona para `/entrar`.
- `src/db/schema.ts` — as quatro tabelas do Better Auth (`user`, `session`, `account`,
  `verification`), geradas por `npx @better-auth/cli generate` e coladas no schema único.
- `src/db/migrations/0001_auth.sql` — as quatro tabelas **mais a FK
  `campaigns.owner_id → user.id`**, que o PR 1 tinha deixado pendente de propósito.
- `src/app/api/auth/[...all]/route.ts` — Route Handler, não action: quem chama é o GitHub.
- `(auth)/entrar` — um botão. `(app)/layout.tsx` — o gate + cabeçalho com "Sair".
- `domain/slug.ts` + `domain/slug.test.ts`, `domain/campaigns.ts` (criar, listar, buscar).
- `(app)/page.tsx` — lista + `Dialog` de criação; `(app)/c/[campanha]/page.tsx` — abre a
  campanha. A página placeholder em `src/app/page.tsx` saiu (colidia com a rota `/` do grupo).

Decisões tomadas aqui:

1. **Login e logout são Server Actions, não cliente.** `auth.api.signInSocial()` devolve a URL
   do GitHub e a página faz `redirect()`. Sem `createAuthClient`, sem JS de autenticação no
   bundle — o `authClient` entra se e quando alguma tela precisar de estado no cliente.
2. **Os nomes de coluna que a CLI do Better Auth escreve foram apagados** do schema: com
   `casing: 'snake_case'` o Drizzle gera exatamente os mesmos, e a convenção do repositório é
   nunca nomear coluna à mão. As `relations()` geradas também saíram — nada usa `db.query`.
3. **Atenção ao par `session` × `sessions`.** O singular é sessão de login (nome exigido pelo
   adapter, não renomeie); o plural é sessão de mesa, do PR 1.
4. **Escopo por dono vai na consulta, não no render.** `buscarCampanha(ownerId, slug)` — slug
   de outra pessoa é 404, e toda action recomeça por `exigirUsuario()`.
5. **Colisão de slug resolvida pelo índice único**, com até cinco tentativas de `INSERT … ON
   CONFLICT DO NOTHING`, em vez de consultar antes e correr o risco da corrida.

**Verificado:** `typecheck`, `lint`, `test` (3 casos de `slugify`) e `build` passam; a migração
foi aplicada no Neon (13 tabelas, FK presente); com o servidor de produção de pé, `/` e
`/c/qualquer-coisa` devolvem 307 para `/entrar` e a tela de login renderiza.

**Falta para fechar:** um GitHub OAuth App (callback
`http://localhost:3100/api/auth/callback/github`) e os dois valores em `.env.local` —
`GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` estão com `preencher`. O `BETTER_AUTH_SECRET` já
foi gerado.

**Correção depois do primeiro login real (migração `0002_account_issuer`):** o callback do
GitHub voltava `internal_server_error`. A causa não era credencial: **a CLI do Better Auth não
gera a coluna `account.issuer`**, que a versão 1.7 exige — a identidade de uma conta passou a
ser `(issuer, accountId)`, com índice único. O gerador Drizzle deles ficou para trás do runtime.
Coluna e índice foram escritos à mão e estão comentados no schema para não sumirem no próximo
`generate`.

Antes disso houve um susto que não era bug: as credenciais tinham sido coladas no `.env`, mas o
`.env.local` ainda dizia `preencher`, e no Next o `.env.local` ganha. As quatro variáveis do
Better Auth moram no `.env.local` — o `.env` é reescrito inteiro pelo `vercel env pull`.

**Pronto quando:** você entra com GitHub, cria a campanha "Sombras de Valoria" e ela aparece na
lista após um F5. ✅ **Feito em 2026-08-29:** login pelo GitHub, campanha e página criadas.

### PR 3 — editor e salvamento  ✅ concluído

```bash
npm i @tiptap/react @tiptap/pm @tiptap/core @tiptap/starter-kit       @tiptap/extension-placeholder @tiptap/extension-list   # 3.30.5
```

O plano pedia `extension-task-list` e `extension-task-item`; no Tiptap 3 os dois vivem dentro de
`@tiptap/extension-list`, e as listas comuns já vêm no StarterKit.

Entregue:

- `src/editor/Editor.tsx` — Tiptap controlado, `immediatelyRender: false` (sem isso o SSR do
  Next quebra a hidratação), StarterKit + TaskList/TaskItem + Placeholder. Sem menção ainda.
- `src/editor/rascunho.ts` (+ 6 casos no Vitest) — o snapshot em `localStorage`.
- `domain/documents.ts` — `salvarDocumento()`, ainda sem derivação.
- `domain/entities.ts` — criar, listar e buscar por slug. `domain/slug.ts` ganhou
  `inserirComSlugUnico()`, que as campanhas passaram a usar também.
- `c/[campanha]/e/[slug]` — a rota única de entidade, renderizando o corpo.
- Criação de página na tela da campanha, para haver o que abrir antes do `@` do PR 4.

Decisões tomadas aqui:

1. **O rascunho local guarda a versão de origem, não um horário.** O snapshot leva o `updatedAt`
   que o servidor devolveu quando o editor abriu, e só é recuperado se o servidor ainda estiver
   nessa versão. Comparar o `Date.now()` do navegador com o `now()` do Postgres descartaria
   rascunho válido em qualquer máquina com o relógio atrasado — perda silenciosa de texto, que é
   exatamente o que o R2 manda evitar.
2. **O rascunho só é apagado quando o servidor confirma.** Falha de rede deixa o texto no
   navegador, e a barra de status diz isso.
3. **`TiptapDoc` virou `JSONContent & { type: 'doc' }`** — era um placeholder com `unknown[]` no
   PR 1. Custou declarar `@tiptap/core` como dependência.
4. **A posse vai no `WHERE` do `UPDATE`**, por `EXISTS` sobre `campaigns`: uma ida ao banco, e id
   de entidade alheia simplesmente não casa.
5. **Tipografia do editor escrita à mão** em `globals.css` — quinze linhas contra a dependência
   `@tailwindcss/typography`, e é o único lugar do app que precisa dela.
6. **`vitest.config.mts`** passou a existir só pelo alias `@/`: até aqui os testes só importavam
   tipo, que o esbuild apaga sem resolver.

Achado de tabela: **o `shadcn init` deixou `--font-sans: var(--font-sans)`** no `@theme`, uma
auto-referência que fazia o app inteiro renderizar em Times New Roman desde o PR 0. Corrigido
para `var(--font-geist-sans)`.

**Verificado:** `typecheck`, `lint`, `test` (13 casos) e `build` passam. Prova ponta a ponta
contra o Neon, com usuário/campanha/entidade descartáveis: o corpo grava e volta igual, a FTS
acha "floresta negra" **dentro do JSON do Tiptap**, um segundo dono não lê nem escreve a mesma
entidade, e a segunda campanha de mesmo nome vira `sombras-de-valoria-2`. No navegador, numa
página de prova temporária cujo salvamento falhava de propósito: parágrafo digitado → snapshot
no `localStorage` → recarga → texto de volta, com o aviso "Rascunho local recuperado".

**Pronto quando:** você escreve um parágrafo, fecha a aba no meio da digitação, reabre e o texto
está lá. ✅ **Coberto por Playwright** (`e2e/editor.spec.ts`), num teste que derruba a rede da
aba para o salvamento falhar de verdade em vez de correr contra o debounce.

#### Os testes e2e (acréscimo ao plano)

Playwright entrou aqui a pedido: `npm run test:e2e`, `next dev` na **3101** para nunca brigar
com a 3100. O aperto de mão do GitHub não é automatizável, então `e2e/apoio.ts` planta as linhas
`user` e `session` e assina o cookie como o better-call assina (HMAC-SHA256, `token.assinatura`,
percent-encoded). A fixture `usuario` dá um usuário descartável por teste e o apaga no fim — o
cascade limpa campanhas e páginas junto, então a suíte nunca deixa lixo no seu banco.

**O primeiro run achou dois defeitos que os testes de unidade não pegariam:**

1. **Quebra de hidratação no editor.** A recuperação do rascunho era feita durante a renderização
   (`useState(() => lerRascunho(...))`), o que dá vazio no servidor e o rascunho no cliente. O
   React se recuperava regenerando a árvore, então na tela parecia funcionar. Virou `useEffect` +
   `setContent(..., { emitUpdate: false })`.
2. **Não existia sinal de "salvo".** A barra de status ficava vazia tanto digitando quanto depois
   de gravar, o que impedia o teste de esperar pelo salvamento — e impedia você de saber se o
   texto estava seguro. Estado `salvo` acrescentado.

### PR 4 — a menção `@` ⭐  ✅ concluído

```bash
npm i @tiptap/extension-mention uuidv7   # 3.30.5 / 1.2.1
```

Entregue:

- `src/editor/mention.ts` — `Mention` + `Suggestion` no `@`, e `src/editor/ListaDeMencao.tsx`,
  o popover: resultados da campanha e, embaixo, **"Criar «X» como…"** com os tipos.
- **Cache local** — a página da entidade carrega `{ id, name, typeKey }` da campanha inteira e o
  filtro é em memória, sem rede no meio da digitação.
- **UUIDv7 no cliente** — o nó entra com o id definitivo e o `INSERT` vai em segundo plano. A
  entidade recém-nascida entra no cache na hora, então mencioná-la de novo na frase seguinte
  acha em vez de oferecer criar de novo (tem teste).
- `criarEntidadeMencionadaAction` e `listarTiposDeEntidade`; `criarEntidade` aceita id do cliente.

Decisões e desvios:

1. **`GET /api/mencoes` não existe.** O plano já o chamava de fallback; com o cache local ele não
   tem chamador. Entra quando existir uma campanha grande o bastante para provar que precisa.
2. **Os atributos do nó são declarados à mão.** A extensão da biblioteca traz um terceiro
   (`mentionSuggestionChar`), e herdar via `this.parent()` deixava o nó sem atributo nenhum no
   `getJSON()`. Declarados explicitamente, o documento fica exatamente
   `{ type: 'mention', attrs: { id, label } }` — a forma que o invariante 1 exige e que o
   `extract.ts` do PR 5 vai percorrer.
3. **Sem espaço no gatilho** (padrão do Tiptap): `@Lady_Morgana`, como o próprio README já
   escrevia. Atalho de letra para escolher o tipo ficou de fora — seta e Enter bastam.
4. **Sem `tippy`**: o `Suggestion` do Tiptap 3 já posiciona o popover (`props.mount`).

**O defeito que só o e2e acharia:** a menção chegava ao banco como `{ type: 'mention' }`, sem id
nem label, e voltava do F5 como `@null`. O cliente enviava certo; o servidor recebia sem. Causa:
**os `attrs` do ProseMirror são objetos sem protótipo** (`Object.create(null)`), e o serializador
das Server Actions os descarta **em silêncio** — sem erro, sem aviso. Uma volta pelo JSON no
`onUpdate` resolve, e o comentário no código explica por que ela está lá.

**Pronto quando:** digitando `@Roderick` num texto novo, você cria o NPC e continua a frase
**sem tirar a mão do teclado e sem esperar carregamento visível.** ✅ Coberto por
`e2e/mencao.spec.ts` (cria e segue a frase; guarda id e não nome; reaproveita a entidade na
segunda menção). O orçamento de < 50 ms não foi medido — o filtro é em memória, sem rede.

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
