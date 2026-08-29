import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

import { db } from '@/db';
import * as schema from '@/db/schema';

function env(nome: string) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} ausente — ver .env.example e docs/FASE-0.md`);
  return valor;
}

/**
 * Localmente vem do `.env.local`. Na Vercel, do domínio estável de produção —
 * que é o único que serve, já que o callback do OAuth está registrado no GitHub
 * por URL fixa e o domínio de preview muda a cada deploy.
 */
function urlPublica() {
  const explicita = process.env.BETTER_AUTH_URL;
  if (explicita) return explicita;

  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (producao) return `https://${producao}`;

  throw new Error('BETTER_AUTH_URL ausente — ver .env.example e docs/FASE-0.md');
}

function criar() {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: env('BETTER_AUTH_SECRET'),
    baseURL: urlPublica(),
    socialProviders: {
      github: {
        clientId: env('GITHUB_CLIENT_ID'),
        clientSecret: env('GITHUB_CLIENT_SECRET'),
      },
    },
    // Deixa as Server Actions gravarem o cookie de sessão. Precisa ser o último plugin.
    plugins: [nextCookies()],
  });
}

let instancia: ReturnType<typeof criar> | undefined;

/**
 * Preguiçoso de propósito, e a preguiça é o conserto de um defeito real: com a
 * instância criada no topo do módulo, o `next build` — que importa a rota de auth
 * para coletar configuração — morria se faltasse credencial. Uma variável de
 * ambiente ausente derrubava o **build inteiro** em vez da requisição que
 * precisava dela, e todo deploy da Fase 0 foi para produção quebrado por isso.
 *
 * Credencial é assunto de runtime. Faltando, quem tem que falhar é quem entra.
 *
 * Um provedor OAuth e nada mais: sem e-mail, sem magic link (ARQUITETURA.md §3.5).
 */
export function obterAuth() {
  return (instancia ??= criar());
}

/**
 * Sessão do request atual, ou `null`.
 *
 * Lê os cabeçalhos **antes** de tocar em `obterAuth()`, e a ordem importa: é o
 * `await headers()` que marca a rota como dinâmica. Ao contrário, o prerender do
 * build entra na função, esbarra na credencial ausente e derruba o build de novo
 * — foi exatamente o segundo sintoma do mesmo defeito.
 */
export async function sessaoAtual() {
  const cabecalhos = await headers();
  return obterAuth().api.getSession({ headers: cabecalhos });
}

/**
 * O usuário do request, ou redireciona para o login. É a fronteira de confiança:
 * toda Server Action e toda página do grupo (app) começa por aqui — renderizar
 * só a UI autenticada não é barreira de segurança.
 */
export async function exigirUsuario() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  return sessao.user;
}
