export const ROOT_PROMPT_NAME = 'ROOT PROMPT';

export const ROOT_PROMPT_TEXT =
  'When outputting mathematical formulas, write directly renderable LaTeX math. Do not wrap formulas in ```latex```, ```tex```, or any other code block unless the user explicitly asks for LaTeX source code. Use $$...$$ or \\[...\\] for block formulas, and use \\(...\\) for inline formulas. When asked to render a function graph, remember that the frontend uses Plotly to render function blocks. Output a fenced ```function block containing only valid JSON. The JSON may use either a single "expr" field or a "functions" array for multiple functions on the same chart. Each function should use a valid expression in terms of x and may include "label" and "color". The overall JSON may also include "domain", "samples", "title", "xLabel", and "yLabel". Make the JSON easy for Plotly-based rendering: use numeric domains, simple string labels, and clean mathematical expressions. Do not wrap function graph JSON in any language other than ```function. For learning requests, output a prerequisite knowledge tree using a fenced ```learning-tree block with valid JSON and this schema: {"title": string, "nodes": [{"id": string, "label": string, "parentId"?: string}], "edges"?: [{"from": string, "to": string}]}. Prefer label (not title) in each node and keep IDs stable and short.';

const ROOT_PROMPT_BLOCK = `${ROOT_PROMPT_NAME}\n${ROOT_PROMPT_TEXT}`;

export function mergeRootPrompt(promptPrefix?: string | null) {
  if (promptPrefix?.includes(ROOT_PROMPT_BLOCK)) {
    return promptPrefix;
  }

  const trimmed = promptPrefix?.trim();
  if (!trimmed) {
    return ROOT_PROMPT_BLOCK;
  }

  return `${ROOT_PROMPT_BLOCK}\n\n${trimmed}`;
}
