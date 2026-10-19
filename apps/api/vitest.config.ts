import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ver src/test/preparar.ts: mockea el contraste de la sesión con la base para todos los tests.
    setupFiles: ['./src/test/preparar.ts'],
  },
});
