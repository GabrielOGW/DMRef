import { createHmac } from 'node:crypto';

import { test as base } from '@playwright/test';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { session, user } from '@/db/schema';

import { BASE_URL } from '../playwright.config.ts';

/**
 * O handshake do OAuth é do GitHub e não dá para automatizar. O que dá — e é o
 * que interessa testar — é tudo depois dele: a sessão gravada e o cookie assinado.
 * Então plantamos os dois direto, no mesmo formato que o Better Auth usa.
 *
 * Assinatura igual à do better-call: HMAC-SHA256 do valor, base64, `valor.assinatura`,
 * tudo percent-encoded como o navegador guardaria.
 */
function assinarCookie(valor: string, segredo: string) {
  const assinatura = createHmac('sha256', segredo).update(valor).digest('base64');
  return encodeURIComponent(`${valor}.${assinatura}`);
}

const NOME_DO_COOKIE = 'better-auth.session_token';

async function criarUsuarioDeTeste() {
  const segredo = process.env.BETTER_AUTH_SECRET;
  if (!segredo) throw new Error('BETTER_AUTH_SECRET ausente — ver docs/FASE-0.md');

  const id = `e2e-${crypto.randomUUID()}`;
  const token = crypto.randomUUID();
  const agora = new Date();

  await db.insert(user).values({ id, name: 'Mestre de Teste', email: `${id}@exemplo.test` });
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: id,
    token,
    // A coluna é NOT NULL sem default (assim a CLI do Better Auth a gera).
    updatedAt: agora,
    expiresAt: new Date(agora.getTime() + 60 * 60 * 1000),
  });

  return { id, cookie: assinarCookie(token, segredo) };
}

/** Apagar o usuário derruba sessão, campanhas e páginas em cascata. */
async function apagarUsuarioDeTeste(id: string) {
  await db.delete(user).where(eq(user.id, id));
}

/**
 * `usuario` entrega uma sessão nova por teste e a recolhe no fim, então nenhum
 * teste vê o que o outro escreveu — nem o que você escreveu no seu banco.
 */
export const test = base.extend<{ usuario: string }>({
  // O segundo parâmetro é o `use` do Playwright; chama-se `usar` aqui porque a
  // regra react-hooks confunde `use(...)` com o hook do React e falha o lint.
  usuario: async ({ context }, usar) => {
    const { id, cookie } = await criarUsuarioDeTeste();
    await context.addCookies([{ name: NOME_DO_COOKIE, value: cookie, url: BASE_URL }]);
    try {
      await usar(id);
    } finally {
      await apagarUsuarioDeTeste(id);
    }
  },
});

export { expect } from '@playwright/test';
