import "../lib/monaco";
import { DEFAULT_STYLES } from "./utils";
import type {
  FileSystemTree,
  WebContainer as Runtime,
} from "@webcontainer/api";

// @ts-ignore
import { initialize as loadAstro } from "@astrojs/compiler";
import astroWASM from "@astrojs/compiler/astro.wasm?url";
import * as monaco from "monaco-editor";

import * as pkgJSON from "../assets/package.json";
import * as pkgLockJSON from "../assets/package-lock.json";
import astroConfig from "../assets/astro.config.mjs?raw";
import svelteConfig from "../assets/svelte.config.mjs?raw";
import tsConfig from "../assets/tsconfig.json?raw";
import envTs from "../assets/env.d.ts?raw";
import defaultStyles from "../assets/default.css?raw";

import { WebContainer } from "@webcontainer/api";
import { setupEditor } from "./editor";

interface State {
  id: string;
  elements: {
    root: HTMLElement;
    nav: HTMLElement;
    editor: HTMLElement;
    preview: HTMLIFrameElement;
    files: HTMLScriptElement;
  };
  reset: () => void;
  activePath: string;
  editor: monaco.editor.IStandaloneCodeEditor;
  runtime: Runtime;
  models: monaco.editor.ITextModel[];
}

/** @type {import('@webcontainer/api').WebContainer}  */
await loadAstro({ wasmURL: astroWASM });

globalThis["@astrojs/playground/runtime"] =
  globalThis["@astrojs/playground/runtime"] || (await WebContainer.boot());

const runtime = globalThis["@astrojs/playground/runtime"] as Runtime;

const installAstro = async () => {
  await runtime.mount({
    "~": {
      directory: {
        projects: {
          directory: {},
        },
      },
    },
    "package.json": {
      file: {
        contents: JSON.stringify(pkgJSON, null, 2),
      },
    },
    "package-lock.json": {
      file: {
        contents: JSON.stringify(pkgLockJSON, null, 2),
      },
    },
  });

  const installProcess = await runtime.spawn("npm", ["install"]);
  const installProcessExit = await installProcess.exit;

  return installProcessExit;
};

let count = 0;

async function init(root: HTMLElement) {
  const id = `project-${count++}`;

  const elements = {
    root,
    nav: root.querySelector("[data-nav]") as HTMLElement,
    editor: root.querySelector("[data-editor]") as HTMLElement,
    preview: root.querySelector("[data-preview]") as HTMLIFrameElement,
    files: root.querySelector("[data-files]") as HTMLScriptElement,
  };

  const initialFiles = JSON.parse(elements.files.innerHTML);

  elements.files.remove();

  const models = initialFiles.map((file) =>
    monaco.editor.createModel(
      file.code,
      file.lang,
      monaco.Uri.from({ scheme: id, path: file.name })
    )
  );

  const editor = await setupEditor(elements.editor, models[0]);

  const url = await setupRuntime(elements.preview, runtime, id, initialFiles);

  elements.preview.src = `${url}`;
  elements.preview.setAttribute("src", `${url}`);

  if (elements.preview.parentElement.classList.contains("loading")) {
    const loader = elements.preview.parentElement.querySelector(".loader");
    elements.preview.parentElement.classList.remove("loading");
    setTimeout(() => {
      loader.remove();
    }, 500);
  }

  elements.preview.style.setProperty("opacity", "1");

  const state: State = {
    id,
    reset: () => {
      initialFiles.forEach((file) => {
        const model = models.find(
          (model) => model.uri.path === file.name
        ) as monaco.editor.ITextModel;
        model.setValue(file.code);
      });
      const entry = initialFiles[0].name;
      elements.nav
        .querySelector("[data-file][aria-selected]")
        .removeAttribute("aria-selected");
      elements.nav
        .querySelector(`[data-file="${entry}"]`)
        .setAttribute("aria-selected", "true");
      editor.setModel(models[0]);
    },
    elements,
    editor,
    runtime,
    activePath: initialFiles[0].name,
    models,
  };

  syncState(state);
  nav(state);
  resize(state);
}

let ports = new Map();

async function setupRuntime(
  element: HTMLIFrameElement,
  runtime: Runtime,
  id: string,
  input: { name: string; code: string }[]
): Promise<string> {
  return new Promise(async (resolve) => {
    let myPort: number;

    runtime.on("server-ready", (port, url) => {
      ports.set(port, url);
      if (port === myPort) {
        element.src = url;
        resolve(url);
      }
    });

    const index = input.find((file) => file.name === "/src/pages/index.astro");

    if (!index) {
      const firstComponent = input.find((file) => file.name.endsWith(".astro"));
      input.push({
        name: "/src/pages/index.astro",
        code: `
            ---
            import Component from "${firstComponent.name}";
            ---
            <Component />
        `,
      });
    }

    const files: FileSystemTree = {};

    for (const f of input) {
      const fullpath = f.name.split("/").slice(1);
      let target = files;
      for (const part of fullpath.slice(0, -1)) {
        if (target[part] === undefined) {
          target[part] = { directory: {} };
        }
        target = target[part]["directory"];
      }
      target[fullpath.at(-1)] = {
        file: {
          contents: f.code,
        },
      };
    }

    files["default.css"] = {
      file: {
        contents: defaultStyles,
      },
    };

    if (!files["astro.config.mjs"]) {
      files["astro.config.mjs"] = {
        file: {
          contents: astroConfig,
        },
      };
    }

    if (!files["svelte.config.mjs"]) {
      files["svelte.config.mjs"] = {
        file: {
          contents: svelteConfig,
        },
      };
    }

    files["tsconfig.json"] = {
      file: {
        contents: tsConfig,
      },
    };

    files["src"]["env.d.ts"] = {
      file: {
        contents: envTs,
      },
    };

    const installationExitCode = await installAstro();

    if (installationExitCode !== 0) {
      const message = "Installation failed!";
      console.error(message);
      throw new Error(message);
    }

    runtime.mount({
      projects: {
        directory: {
          projects: {
            directory: {},
          },
        },
      },
    });

    await runtime.mount(
      { [`${id}`]: { directory: files } },
      { mountPoint: `projects/` }
    );

    const runAstroServerProcess = await runtime.spawn("astro", ["dev"], {
      cwd: `projects/${id}`,
    });

    runAstroServerProcess.output.pipeTo(
      new WritableStream({
        write: (data) => {
          if (data.includes("localhost:")) {
            myPort = Number.parseInt(data.split("localhost:")[1].split("/")[0]);
          }
          if (ports.has(myPort)) {
            const url = ports.get(myPort);
            resolve(url);
          }
        },
      })
    );
  });
}

function nav(state: State) {
  const {
    models,
    editor,
    elements: { nav: element, preview },
  } = state;
  function updatePath(e: Event) {
    const target = (e.target as HTMLElement).closest(
      "[data-file]"
    ) as HTMLElement;
    const path = target?.dataset.file;
    if (!path) return;
    if (path === state.activePath) return;
    for (const el of element.querySelectorAll("[data-file][aria-selected]")) {
      el.removeAttribute("aria-selected");
    }
    target.setAttribute("aria-selected", "true");
    const model = models.find((m) => path === m.uri.path);
    editor.setModel(model);
  }

  async function doAction(e: Event) {
    const target = (e.target as HTMLElement).closest(
      "[data-action]"
    ) as HTMLElement;
    const action = target?.dataset.action;
    if (!action) return;
    switch (action) {
      case "reload": {
        // state.reset();
        preview.setAttribute("src", preview.getAttribute("src"));
        return;
      }
      case "download": {
        const res = await fetch("/_api/playground", {
          method: "POST",
          body: JSON.stringify({ files: [] }),
        });
        const text = await res.text();
        console.log({ text });
        return;
      }
    }
  }
  element.addEventListener("click", (e) => {
    updatePath(e);
    doAction(e);
  });
}

function resize({ editor, elements }: State) {
  const media = window.matchMedia("(min-width: 960px)");
  let multiplier = media.matches ? 0.5 : 1;
  let screenHeight = window.innerHeight;
  media.addEventListener("change", ({ matches }) => {
    if (matches) {
      multiplier = 0.5;
    } else {
      multiplier = 1;
    }
  });
  const ro = new ResizeObserver(([entry]) => {
    screenHeight = window.innerHeight;
    const { height } = editor.getLayoutInfo();
    editor.layout({ width: entry.contentRect.width * multiplier - 16, height });
  });
  ro.observe(elements.editor.parentElement ?? elements.editor);

  function autogrow() {
    const { width } = editor.getLayoutInfo();
    const lines = editor.getModel().getLineCount();
    const height = Math.max(Math.min(lines * 22 + 12, screenHeight * 0.8), 192);
    editor.layout({ width, height });
    elements.root.style.setProperty(
      `--playground-content-height`,
      `${height}px`
    );
  }
  editor.onDidChangeModelContent(autogrow);
  editor.onDidChangeModel(autogrow);
  autogrow();
}

function syncState(state: State) {
  const { id, editor, runtime } = state;
  const updateActivePath = ({ newModelUrl: { path } }) => {
    state.activePath = path;
    update();
  };

  editor.onDidChangeModel(updateActivePath);
  const update = debounce(async () => {
    const text = editor.getValue();
    const activePath = state.activePath;
    const parts = activePath.split("/");

    await runtime.mount(
      { [parts.at(-1)]: { file: { contents: text } } },
      { mountPoint: `projects/${id}/${parts.slice(1, -1).join("/")}` }
    );
  }, 30);
  editor.onDidChangeModelContent(debounce(update, 300));
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

export default async function setup() {
  for (const playground of document.querySelectorAll("[data-playground]")) {
    init(playground as HTMLElement);
  }
}
