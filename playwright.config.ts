import { defineConfig, devices } from '@playwright/test';

// Mesma leitura de env do drizzle.config.ts: o Playwright não carrega .env sozinho,
// e as fixtures falam com o banco tanto quanto o servidor.
for (const arquivo of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(arquivo);
  } catch {
    // ausente é normal — em CI a env vem do ambiente
  }
}

// Porta própria: a 3100 é do `npm run dev`, e quem sobe servidor aqui não pode
// brigar com o que o autor deixou aberto (ver o CLAUDE.md da raiz do workspace).
const PORTA = 3101;
export const BASE_URL = `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: './e2e',
  // Um banco só para todos os testes: usuário descartável por teste, sem paralelismo.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `dev`, não `start`: em produção o Better Auth exige cookie `__Secure-`, que
    // não trafega em http. O servidor de desenvolvimento é o análogo honesto aqui.
    command: `npx next dev -p ${PORTA}`,
    url: `${BASE_URL}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: BASE_URL },
  },
});
