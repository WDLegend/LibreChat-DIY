# LibreChat Rendering Notes

## Purpose

This note records what LibreChat currently renders in chat messages and where to change the rendering behavior later. This file is intended to be part of the long-term `project/` knowledge base.

## What LibreChat Currently Renders

Main frontend markdown entry:

- `LibreChat/client/src/components/Chat/Messages/Content/Markdown.tsx`

Current supported rendering types in chat content:

- standard Markdown
  - headings
  - paragraphs
  - lists
  - blockquotes
- GFM via `remark-gfm`
  - tables
  - task lists
  - GitHub-style markdown extensions
- code blocks with syntax highlighting
  - examples: `python`, `js`, `ts`, `json`, `bash`
- inline code
- math content via `remark-math` and `rehype-katex`
- Mermaid diagrams via fenced block language `mermaid`
- artifacts via markdown directives and custom `artifact` nodes
- citations and highlighted citation spans
- MCP UI resources and carousels
- custom link handling for file links
- custom image handling for internal image paths

## Important Limitation: LaTeX Fenced Blocks

LibreChat currently does not treat ` ```latex ` as a special math-rendering block.

What works reliably today:

- `$$ ... $$`
- `\[ ... \]`
- `\( ... \)`
- ` ```math ` in the current custom branch logic

What does not automatically render as math:

- ` ```latex `
- ` ```tex `

Reason:

- special handling in the current `code` renderer checks `lang === 'math'`
- `latex` and `tex` are not mapped to the math path yet

## Rendering Pipeline

### 1. Message content enters `Markdown.tsx`

File:

- `LibreChat/client/src/components/Chat/Messages/Content/Markdown.tsx`

What happens here:

- message text is preprocessed
- markdown is parsed by `ReactMarkdown`
- remark plugins are attached
- rehype plugins are attached
- selected node types are replaced with custom React components

Key plugins currently active:

- `remark-gfm`
- `remark-math`
- `remark-directive`
- `remark-supersub`
- `artifactPlugin`
- `unicodeCitation`
- `mcpUIResourcePlugin`
- `rehype-katex`
- `rehype-highlight`

Key custom node mapping:

- `code`
- `a`
- `p`
- `img`
- `artifact`
- `citation`
- `highlighted-text`
- `composite-citation`
- `mcp-ui-resource`
- `mcp-ui-carousel`

This is the top-level place to change parser plugins or add new custom node renderers.

## Code Block Rendering Flow

Main code routing file:

- `LibreChat/client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`

The `code` renderer does the main dispatching.

Current decision flow:

1. read the fenced block language from `className`
2. detect whether the block is:
   - `math`
   - `mermaid`
   - single-line inline code
   - regular multi-line code block
3. route to the appropriate renderer

Current branch behavior:

- `math` -> return children directly for math rendering path
- `mermaid` -> render `Mermaid`
- single-line code -> render inline `<code>`
- everything else -> render `CodeBlock`

This file is the most important extension point for adding new block types.

## Main Code Block UI

File:

- `LibreChat/client/src/components/Messages/Content/CodeBlock.tsx`

This component is the UI shell for regular multi-line code blocks.

It handles:

- code container UI
- top toolbar
- floating action toolbar
- copy behavior
- run-code behavior
- output rendering under the block
- switching between multiple tool outputs

Related files:

- `LibreChat/client/src/components/Messages/Content/CodeBar.tsx`
- `LibreChat/client/src/components/Messages/Content/FloatingCodeBar.tsx`
- `LibreChat/client/src/components/Messages/Content/RunCode.tsx`

## Code Execution Flow

Execution button entry:

- `LibreChat/client/src/components/Messages/Content/RunCode.tsx`

When the user runs code:

- code text is read from the rendered code element
- language is normalized
- request payload includes:
  - `messageId`
  - `conversationId`
  - `partIndex`
  - `blockIndex`
  - `lang`
  - `code`
- the request goes through `useToolCallMutation`

Mutation file:

- `LibreChat/client/src/data-provider/Tools/mutations.ts`

On success, the tool result is written into React Query cache.

Mapping logic:

- `LibreChat/client/src/utils/map.ts`

Key used to associate a result to a block:

- `messageId_partIndex_blockIndex_toolId`

This is why each code block gets a stable `blockIndex`.

## Code Block Indexing

File:

- `LibreChat/client/src/Providers/CodeBlockContext.tsx`

Purpose:

- assign a stable index to each multi-line code block in a message
- allow tool results to attach back to the correct block

This matters if future custom blocks also need block-level actions or server-returned results.

## Artifact Rendering

File:

- `LibreChat/client/src/components/Artifacts/Artifact.tsx`

Artifacts are not regular markdown code blocks.
They are parsed through `remark-directive` and the custom `artifactPlugin`.

Current behavior:

- markdown directives named `artifact` become custom render nodes
- artifact content is extracted and stored in artifact state
- UI entry is rendered through `ArtifactButton`

This is a second extension path besides fenced code blocks.

## Citation Rendering

Main parser file:

- `LibreChat/client/src/components/Web/plugin.ts`

This plugin scans text and replaces special markers with custom nodes such as:

- `citation`
- `composite-citation`
- `highlighted-text`

This explains why search references and highlighted spans render differently from plain markdown text.

## Best Places to Modify Rendering

### Add a new fenced block type

Best file:

- `LibreChat/client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`

Example future additions:

- `function`
- `graph`
- `tree`
- `plot`

Recommended pattern:

- detect `lang === 'function'`
- return a custom React component instead of `CodeBlock`

For example, the dispatch can evolve from:

- `math` -> math
- `mermaid` -> Mermaid
- `python/js/...` -> `CodeBlock`

into:

- `function` -> `FunctionPlotBlock`
- `graph` -> `KnowledgeGraphBlock`
- `tree` -> `KnowledgeTreeBlock`
- `math` -> math
- `mermaid` -> Mermaid
- other code -> `CodeBlock`

### Add toolbar actions to normal code blocks

Best files:

- `LibreChat/client/src/components/Messages/Content/CodeBlock.tsx`
- `LibreChat/client/src/components/Messages/Content/CodeBar.tsx`
- `LibreChat/client/src/components/Messages/Content/FloatingCodeBar.tsx`

Good for:

- extra buttons
- custom export actions
- visual toggles
- side panels under code blocks

### Add new markdown syntax or AST transforms

Best file:

- `LibreChat/client/src/components/Chat/Messages/Content/Markdown.tsx`

Good for:

- new remark plugins
- new rehype plugins
- new custom node mappings

### Add an artifact-style rendering path

Best files:

- `LibreChat/client/src/components/Artifacts/Artifact.tsx`
- artifact-related components under `LibreChat/client/src/components/Artifacts/`

Good for:

- content blocks that deserve their own state and side-panel workflow
- larger generated outputs that should not live inline as simple markdown

## Suggested Path for Educational Features

For this project, the easiest path is to extend fenced code block languages first.

Suggested initial additions:

- `function`
- `graph`
- `tree`

Why this is the best starting point:

- it matches the existing `MarkdownComponents.tsx` dispatch pattern
- it keeps model output simple
- it does not require changing the full message schema immediately
- it can later evolve into a more structured block system

## Recommended Next Implementation Step

If educational rendering is the goal, the next code change should likely happen in:

- `LibreChat/client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`

That is the cleanest place to teach LibreChat that some fenced blocks are not code, but custom renderable learning blocks.
