import { defineConfig } from 'vite';

// base './' para que funcione aunque el sitio se publique dentro de una subcarpeta.
export default defineConfig({
  base: './',
  esbuild: { jsxFactory: 'h', jsxFragment: 'Fragment' },
});
