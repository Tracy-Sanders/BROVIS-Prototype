import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.js'],
    environmentMatchGlobs: [
      ['tests/integration/**', 'jsdom'],
      ['tests/unit/**', 'node'],
      ['tests/api/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/claude.js', 'src/display/llm-*.js', 'server/index.js'],
    },
  },
});
