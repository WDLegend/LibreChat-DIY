# LibreChat Function Plot Notes

## Goal

Add a new fenced block renderer so the model can output a `function` block and the frontend renders an interactive function graph with Plotly.

## Current Implementation

### Entry Point

The function block is wired into:

- `LibreChat/client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`

Current special block handling now includes:

- `math`
- `mermaid`
- `function`
- regular code blocks

The new branch is:

- `lang === 'function'` -> `FunctionPlot`

### Renderer Component

Main component:

- `LibreChat/client/src/components/Messages/Content/FunctionPlot.tsx`

This component currently:

- parses JSON from the fenced block body
- supports either a single `expr` or a multi-function `functions` array
- supports optional `domain`
- supports optional `samples`
- supports optional `title`
- supports optional `xLabel`
- supports optional `yLabel`
- supports optional `color`
- evaluates the function with `mathjs`
- renders an interactive line plot with Plotly
- shows a legend automatically when multiple functions are present

### Libraries Used

- `react-plotly.js`
- `plotly.js-basic-dist-min`
- `mathjs`

We intentionally switched to `plotly.js-basic-dist-min` instead of full Plotly to reduce bundle impact.

## Supported Input Format

The model should output a fenced block like this:

````md
```function
{"expr":"sin(x)","domain":[-10,10]}
```
````

More complete example:

````md
```function
{
  "expr": "x^2 - 4*x + 3",
  "domain": [-2, 6],
  "samples": 300,
  "title": "Quadratic Example",
  "xLabel": "x",
  "yLabel": "f(x)",
  "color": "#dc2626"
}
```
````

Multi-function example:

````md
```function
{
  "domain": [0.1, 8],
  "title": "Exponential vs Logarithm",
  "functions": [
    { "expr": "exp(x)", "label": "y=e^x", "color": "#2563eb" },
    { "expr": "log(x)", "label": "y=ln(x)", "color": "#dc2626" }
  ]
}
```
````

## Current Behavior

When the block is valid:

- the chart renders as an interactive Plotly graph
- user can pan
- user can zoom
- user gets hover coordinates
- multiple functions can be compared on the same chart

When the block is invalid:

- the UI shows an error panel
- the original block content is still shown underneath for debugging

## Local Development Workflow

We are now treating local development as the default workflow.

That means:

- prefer `npm run frontend:dev`
- verify in browser via the Vite dev server
- avoid repeated full production builds for every UI tweak

Important current local URL observed during development:

- `http://localhost:3091`

Reason:

- port `3090` was already in use, so Vite automatically moved to `3091`

## Production Build Note

Adding Plotly increases bundle size significantly.

Observed issue:

- LibreChat's frontend build uses PWA precaching
- the `vendor` chunk exceeded Workbox cache size limits
- full production build currently still fails because the vendor bundle remains too large

This is not blocking local feature development, but it does need a follow-up optimization step before production readiness.

Likely follow-up fixes:

- isolate Plotly into its own manual chunk in `client/vite.config.ts`
- or raise PWA `maximumFileSizeToCacheInBytes`
- or exclude the large Plotly chunk from precache if appropriate

## Files Changed

- `LibreChat/client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`
- `LibreChat/client/src/components/Messages/Content/FunctionPlot.tsx`
- `LibreChat/client/src/locales/en/translation.json`
- `LibreChat/client/package.json`

## Recommended Next Step

Before extending into derivatives or multiple curves, the next practical task should be:

- verify the `function` block visually in the browser
- then add a more flexible schema such as multiple expressions or optional axis bounds
