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

// Um provedor OAuth e nada mais: sem e-mail, sem magic link (ARQUITETURA.md §3.5).
// As tabelas de usuário ficam no nosso banco justamente para o escopo por dono
// virar JOIN, não chamada a serviço externo.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: env('BETTER_AUTH_SECRET'),
  baseURL: env('BETTER_AUTH_URL'),
  socialProviders: {
    github: {
      clientId: env('GITHUB_CLIENT_ID'),
      clientSecret: env('GITHUB_CLIENT_SECRET'),
    },
  },
  // Deixa as Server Actions gravarem o cookie de sessão. Precisa ser o último plugin.
  plugins: [nextCookies()],
});

/** Sessão do request atual, ou `null`. */
export async function sessaoAtual() {
  return auth.api.getSession({ headers: await headers() });
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
