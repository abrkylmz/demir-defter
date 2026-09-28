import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 8000 },
  preview: { port: 8000 },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
