import * as monaco from "monaco-editor";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import { createHighlighter } from "shiki";
import { shikiToMonaco } from "@shikijs/monaco";

import { emmetHTML } from "emmet-monaco-es";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
  noSuggestionDiagnostics: false,
});
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

// Create the highlighter, it can be reused
const highlighter = await createHighlighter({
  themes: ["vitesse-dark", "vitesse-light"],
  langs: [
    "javascript",
    "typescript",
    "astro",
    "vue",
    "vue-html",
    "jsx",
    "svelte",
  ],
});

// Register the languageIds first. Only registered languages will be highlighted.
monaco.languages.register({ id: "javascript" });
monaco.languages.register({ id: "typescript" });
monaco.languages.register({ id: "astro" });
monaco.languages.register({ id: "vue" });
monaco.languages.register({ id: "vue-html" });
monaco.languages.register({ id: "jsx" });
monaco.languages.register({ id: "svelte" });

// Register the themes from Shiki, and provide syntax highlighting for Monaco.
shikiToMonaco(highlighter, monaco);

// `emmetHTML` , `emmetCSS` and `emmetJSX` are used the same way
emmetHTML(
  // monaco-editor it self. If not provided, will use window.monaco instead.
  // This could make the plugin support both ESM and AMD loaded monaco-editor
  monaco,
  // languages needs to support html markup emmet, should be lower case.
  ["html", "astro"]
);

emmetHTML(monaco, ["html", "astro"]);
