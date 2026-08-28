import { defineConfig } from 'drizzle-kit';

// Em produção a Vercel injeta as variáveis no ambiente. Localmente elas ficam
// espalhadas em dois arquivos: `vercel env pull` escreve o bloco do Neon em .env
// e `vercel link` escreve o token OIDC em .env.local. Lemos os dois, na ordem.
for (const arquivo of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(arquivo);
  } catch {
    // ausente é normal — na Vercel e em CI a env já vem do ambiente
  }
}

// DDL vai pela conexão direta, não pelo pooler: o PgBouncer em modo transação
// não é o caminho certo para CREATE EXTENSION, advisory locks e migração longa.
// O runtime (src/db/index.ts) continua usando a pooled via DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: url! },
  // Deixa o schema.ts declarar `campaignId` e o banco receber `campaign_id`,
  // sem nomear cada coluna à mão. Precisa casar com src/db/index.ts.
  casing: 'snake_case',
});
