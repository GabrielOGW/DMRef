import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL ausente — copie .env.example para .env.local (ver docs/FASE-0.md)');
}

// Driver HTTP: uma requisição por consulta, sem pool e sem cold start de conexão.
// Transação em lote cobre o salvamento-e-derivação (ver docs/ARQUITETURA.md §6.2).
export const db = drizzle(neon(url), { schema, casing: 'snake_case' });
