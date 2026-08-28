# Grimório

Wiki viva de campanhas de RPG, onde **a estrutura é derivada da escrita**.

Você escreve a sessão; o sistema descobre quem apareceu, onde, e o que aconteceu.

```
Durante a investigação, @Arthas descobriu que @Lady_Morgana esteve
escondida na @Floresta_Negra antes do assassinato do @Rei_Alaric.
```

→ a página da Lady Morgana ganha uma linha no histórico, ordenada por número de sessão.
A Floresta Negra registra a menção. O Rei Alaric idem. Nenhum formulário foi aberto.

**Status:** esqueleto no ar (PR 0). O editor chega no PR 4 — ver [docs/FASE-0.md](docs/FASE-0.md).

## Documentação

| Documento | O quê |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Documento de decisão técnica — visão, benchmark, stack, modelo de domínio, schema, fluxo de referências, roadmap e riscos |
| [docs/FASE-0.md](docs/FASE-0.md) | O plano executável: sequência de PRs até o primeiro `@` funcionando |
| [docs/CUSTO-ZERO.md](docs/CUSTO-ZERO.md) | A stack gratuita, seus limites e o que quebra primeiro |
| [CLAUDE.md](CLAUDE.md) | Invariantes e convenções (para o Claude Code) |

## Stack

Next.js 16 · Neon Postgres · Drizzle · Tiptap · Better Auth · Tailwind + shadcn/ui · Zod ·
Vitest. Hospedado na Vercel.

**Custo: R$ 0,00/mês.**

## Princípio

> Escrever deve ser fácil. Organizar deve acontecer naturalmente.
