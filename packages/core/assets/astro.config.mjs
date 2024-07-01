import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import solidJs from "@astrojs/solid-js";
import svelte from "@astrojs/svelte";
import preact from "@astrojs/preact";

function style() {
  return {
    name: "@astrojs/playground/style",
    hooks: {
      "astro:config:setup": async ({ injectScript }) => {
        injectScript("page-ssr", `import '/default.css';`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    style(),
    preact({
      include: ["**/preact/*"],
      compat: true,
    }),
    react({
      include: ["**/react/*"],
    }),
    svelte({
      include: ["**/svelte/*"],
    }),
    solidJs({
      include: ["**/solid/*"],
    }),
  ],
});
