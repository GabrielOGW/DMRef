# Custo zero

> Objetivo: rodar o Grimório em produção, com deploy contínuo, banco gerenciado e autenticação
> real, **pagando R$ 0,00**. Este documento registra a solução gratuita escolhida, o que ela
> custa em limitações, e o que quebra primeiro.
>
> **Aviso:** limites de free tier mudam com frequência. Os números abaixo são a ordem de grandeza
> conhecida em ago/2026 — confirme na página de preços de cada serviço antes de assumir. As
> *decisões* deste documento não dependem dos números exatos; as margens são enormes para o
> perfil de uso aqui.

---

## Resumo

| Camada | Escolha | Plano | Custo |
|---|---|---|---|
| Hospedagem / CI / CDN | **Vercel** | Hobby | R$ 0 |
| Banco | **Neon Postgres** | Free | R$ 0 |
| Autenticação | **Better Auth** (self-hosted) | open source | R$ 0 |
| Provedor OAuth | **GitHub OAuth App** | — | R$ 0 |
| Busca | **Postgres** (`pg_trgm` + FTS) | — | R$ 0 |
| Editor | **Tiptap** (só extensões MIT) | open source | R$ 0 |
| UI | **Tailwind 4 + shadcn/ui + Base UI** | open source | R$ 0 |
| ORM / validação / testes | **Drizzle + Zod + Vitest** | open source | R$ 0 |
| Domínio | `grimorio.vercel.app` | — | R$ 0 |
| Grafo (fase 3) | **Cytoscape.js** | MIT | R$ 0 |
| Imagens (fase 3) | **Cloudflare R2** | Free (10 GB) | R$ 0 |
| **Total** | | | **R$ 0,00/mês** |

Único custo opcional futuro: **domínio próprio** (~R$ 40–60/ano). Nada mais é necessário.

---

## Por camada

### Hospedagem — Vercel Hobby

Cobre tudo que o projeto precisa: build automático por push, preview por PR, CDN, funções
serverless, HTTPS, `*.vercel.app`.

**Limitações relevantes:**

- **Uso não-comercial.** É um projeto pessoal, então está dentro dos termos. Se um dia virar
  produto pago, precisa migrar para Pro (~US$ 20/mês). Registrado como risco R9.
- Banda mensal e invocações de função com teto generoso — um app de um usuário não chega perto.
- Sem membros de time. Irrelevante aqui.
- Duração máxima de função menor que no Pro. Nenhuma rota deste sistema é longa.

**Vale usar de graça:** *preview deployments*. Cada PR sobe numa URL própria, o que combina com
o branching do Neon (abaixo) para testar migração de schema sem tocar em dados reais.

### Banco — Neon Free

Escolhido em vez de Supabase e Railway por um motivo prático que importa muito neste perfil de
uso:

| | Neon Free | Supabase Free |
|---|---|---|
| Inatividade | **autosuspend** após ~5 min; religa sozinho na próxima query (cold start de ~0,5–1 s) | **pausa o projeto** após ~1 semana sem uso; exige religar manualmente no painel |
| Armazenamento | ~0,5 GB | ~0,5 GB |
| Branching | sim, e integrado ao preview da Vercel | não no mesmo formato |

Uma campanha de RPG é usada de forma intermitente — às vezes duas semanas sem abrir. **O modelo
do Neon tolera isso; o do Supabase não.** É a diferença entre "a primeira query da noite demora
1 s" e "o app está fora do ar e preciso entrar no painel".

**Quanto espaço isso realmente usa?** O conteúdo é texto. Uma sessão longa em JSON do Tiptap
fica na casa de 10–30 KB. Cem sessões + trezentas entidades ≈ **poucos MB**. Os 0,5 GB não são o
limite prático — imagens seriam, e imagens não vão para o Postgres (ver abaixo).

O que limita antes é a cota de **compute** do plano gratuito. Com autosuspend em 5 min e uso
pessoal, a margem é larga.

**Provisionamento:** dá para criar o banco pelo Marketplace da Vercel (a integração injeta
`DATABASE_URL` nos três ambientes automaticamente) ou direto no Neon e colar a env à mão. A
integração é menos trabalho e o mesmo plano gratuito.

### Autenticação — Better Auth + GitHub OAuth

Free tier aqui não é um plano: é software open source rodando no seu próprio banco. **Sem limite
de usuários, sem custo por MAU, sem dependência de terceiro para responder "quem é você".**

Comparação com as alternativas gratuitas:

- **Clerk** — free até ~10k MAU, mas é um serviço externo: identidade fora do banco (sem `JOIN`),
  e o dia em que o plano mudar você tem uma migração de identidade nas mãos.
- **Auth.js** — também gratuito e self-hosted; perde por ergonomia no App Router, não por custo.

**Provedor OAuth: GitHub OAuth App.** Grátis, criação em dois minutos, sem verificação de app,
sem cota. Google Cloud OAuth também é grátis mas exige tela de consentimento e verificação se
sair de "testing" — mais burocracia pelo mesmo resultado.

**Evite magic link no MVP.** Ele exige provedor de e-mail (Resend free = 3k/mês, 100/dia) — mais
uma env, mais um vendor, mais um ponto de falha, para resolver um login que só você usa. OAuth
único é a opção gratuita *e* mais simples.

### Busca — Postgres puro

`pg_trgm` e full-text search são extensões nativas, disponíveis no plano gratuito do Neon. Zero
custo, zero serviço adicional.

O que isso evita pagar: Algolia (free tier existe mas com teto baixo de registros/buscas),
Typesense Cloud (pago), Elasticsearch (pago), e qualquer API de embeddings.

**pgvector também é gratuito no Neon** — a recusa a usá-lo no MVP é técnica, não financeira: o
custo real de embeddings é a chamada de API por salvamento, que aí sim seria paga.

### Editor — Tiptap, só o que é MIT

Ponto de atenção real. O Tiptap é open source (MIT) no núcleo, mas mantém **extensões "Pro"
pagas**. O que o Grimório precisa está do lado gratuito:

| Extensão | Precisa? | Licença |
|---|---|---|
| `@tiptap/starter-kit` | sim | MIT |
| `@tiptap/extension-mention` + `Suggestion` | **sim — é o coração** | MIT |
| `@tiptap/extension-task-list` / `task-item` | sim (pendências) | MIT |
| `@tiptap/extension-placeholder`, `link`, `image` | sim | MIT |
| `Details` (bloco recolhível) | **não** | Pro |
| `UniqueID` | **não** | Pro |
| `Drag Handle` | não (nice-to-have) | verificar versão |
| `Collaboration`, `Comments`, `AI`, `Content AI` | **não** (rejeitados no §9 da arquitetura) | Pro / serviço |

> **Regra:** o nó `secret` (GM-only) é **escrito por nós**, como extensão custom — não usar
> `Details`. São ~40 linhas de `Node.create({...})` e evita a única dependência paga que o
> desenho poderia atrair. Registrado como risco R7.

Antes de instalar qualquer extensão nova, confira a licença. Se um dia o núcleo mudar de
política, a saída é **Lexical** (MIT integral, sem tier pago) — mais trabalho, mesma arquitetura
de dados, porque o que importa (menção como nó com `id`) é agnóstico de editor.

### UI e bibliotecas

Tailwind, shadcn/ui (o código vai para o repo, não é dependência), Base UI, Drizzle, Zod,
Vitest, Cytoscape.js — todos MIT ou equivalente, sem tier pago.

### Imagens e mapas (fase 3)

Não entram antes da fase 3. Quando entrarem:

| Opção | Free tier | Veredito |
|---|---|---|
| **Cloudflare R2** | ~10 GB armazenamento, **sem cobrança de egress** | **melhor opção gratuita** — mapas são arquivos grandes e lidos com frequência; egress zero importa |
| Vercel Blob | incluído no Hobby, cota bem menor | mais simples de integrar, mas aperta rápido com mapas |
| UploadThing | ~2 GB | intermediário |

Decisão: **R2 quando a fase 3 chegar**, Vercel Blob se a integração de 10 minutos valer mais que
a cota naquele momento. Não decida agora.

### Observabilidade

**Não instale nada no começo.** Vercel Hobby já mostra logs de função e erros de build.

Se precisar depois: Sentry free (~5k erros/mês) e Vercel Analytics (cota limitada no Hobby).
Ambos gratuitos, ambos dispensáveis para um usuário.

### CI

**O build da Vercel é o CI.** Um push que quebra `tsc` quebra o deploy, e isso já é o sinal.

Se quiser gate antes do merge: GitHub Actions rodando `typecheck` + `vitest` — gratuito para
repositório público, e ~2.000 min/mês para privado, o que é muito mais do que este projeto
consome. Adicionar só quando os testes existirem (fase 0, PR 5+).

---

## O que quebra primeiro

Em ordem de proximidade real:

1. **Nada, por muito tempo.** O perfil é: um usuário, alguns MB de texto, dezenas de requisições
   por semana. Todos os limites acima têm 2–3 ordens de grandeza de folga.
2. **Compute do Neon**, se o autosuspend for desabilitado ou se algo ficar consultando em loop.
   Mantenha o autosuspend ligado.
3. **Armazenamento**, se um dia mapas ou retratos forem parar no Postgres em base64. **Não faça
   isso** — arquivo vai para blob storage, o banco guarda a URL (`coverUrl`).
4. **Termos do Hobby**, se o projeto deixar de ser pessoal.

## Quando pagar valeria a pena

Só três cenários, e nenhum é do MVP:

- **Domínio próprio** (~R$ 50/ano) — o único gasto que faz sentido cedo, e é estético.
- **Neon pago** — se o cold start incomodar de verdade ou o histórico de branches virar
  ferramenta de trabalho.
- **Vercel Pro** — apenas se o projeto virar comercial.

Até lá: **R$ 0,00.**
