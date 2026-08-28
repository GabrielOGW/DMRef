import { defineConfig } from 'drizzle-kit';

// Em produção a Vercel injeta DATABASE_URL. Localmente lemos .env.local sem
// dependência extra — process.loadEnvFile é nativo do Node (>= 20.12).
try {
  process.loadEnvFile('.env.local');
} catch {
  // ausente em CI e na Vercel, onde a env já vem do ambiente
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Deixa o schema.ts declarar `campaignId` e o banco receber `campaign_id`,
  // sem nomear cada coluna à mão. Precisa casar com src/db/index.ts.
  casing: 'snake_case',
});
