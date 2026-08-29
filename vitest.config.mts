import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// O esbuild do Vitest apaga import de tipo, então até aqui os testes rodavam sem
// conhecer o alias. Módulos de runtime atrás de `@/` (domain, editor) precisam dele.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
