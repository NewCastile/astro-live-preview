/**
 * @type {() => import('astro').AstroIntegration}
 */

export default () => ({
  name: "@astrojs/playground",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      injectRoute({
        pattern: "/_api/playground",
        entrypoint: "@astrojs/playground/routes/api.ts",
      });
    },
    "astro:server:setup": ({ server }) => {
      server.middlewares.use((_, res, next) => {
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        next();
      });
    },
  },
});
