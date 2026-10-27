import { defineConfig } from 'vite';

// base './' para que funcione aunque el sitio se publique dentro de una subcarpeta.
// El catálogo de componentes (storybook.html) solo existe en desarrollo: el build usa únicamente index.html.
export default defineConfig({
  base: './',
  esbuild: { jsxFactory: 'h', jsxFragment: 'Fragment' },
  plugins: [{
    name: 'storybook-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => { if (req.url === '/storybook' || req.url === '/storybook/') req.url = '/storybook.html'; next() });
    },
  }],
});
