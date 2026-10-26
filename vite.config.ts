import { defineConfig } from 'vite';

// base './' para que funcione en https://USUARIO.github.io/ganado/ sin configurar la ruta.
export default defineConfig({
  base: './',
  esbuild: { jsxFactory: 'h', jsxFragment: 'Fragment' },
});
