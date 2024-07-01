import * as monaco from "monaco-editor";

export async function setupEditor(
  element: HTMLElement,
  model: monaco.editor.ITextModel
) {
  const editor = monaco.editor.create(element, {
    model: model,
    theme: "vitesse-dark",
  });
  return editor;
}
