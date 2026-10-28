import { defineConfig } from 'vite';

// base './' para que funcione aunque el sitio se publique dentro de una subcarpeta.
// El catálogo de componentes (storybook.html) solo existe en desarrollo: el build usa únicamente index.html.
export default defineConfig({
  base: './',
  esbuild: { jsxFactory: 'h', jsxFragment: 'Fragment' },
  plugins: [{
    // CSP solo en lo publicado (en desarrollo Vite necesita conexiones que esta regla bloquearía).
    // La app no carga nada externo: código, imágenes y datos salen de ella misma; data:/blob: son los QR y fotos de reportes.
    name: 'csp',
    apply: 'build',
    transformIndexHtml: html => html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`),
  }, {
    name: 'storybook-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => { if (req.url === '/storybook' || req.url === '/storybook/') req.url = '/storybook.html'; next() });
    },
  }],
});
