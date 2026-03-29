# LibreChat Root Prompt Notes

## Goal

Make a non-removable ROOT PROMPT automatically apply to every new conversation in local development.

## What Was Implemented

### Immutable prompt definition

File:

- `LibreChat/client/src/utils/rootPrompt.ts`

This file defines:

- `ROOT_PROMPT_NAME`
- `ROOT_PROMPT_TEXT`
- `mergeRootPrompt(promptPrefix)`

Behavior:

- if a conversation has no `promptPrefix`, ROOT PROMPT becomes the prompt prefix
- if a conversation already has a prompt prefix, ROOT PROMPT is prepended
- if ROOT PROMPT is already present, it is not duplicated

### Auto-injection on new conversations

File:

- `LibreChat/client/src/hooks/useNewConvo.ts`

Behavior:

- every newly created preset is passed through ROOT PROMPT injection
- every newly created conversation also gets ROOT PROMPT injected
- this makes new chats start with ROOT PROMPT automatically

### Send-time enforcement

File:

- `LibreChat/client/src/hooks/Chat/useChatFunctions.ts`

Behavior:

- before a message is sent, the current conversation prompt prefix is passed through `mergeRootPrompt`
- this ensures the ROOT PROMPT still exists even if prompt settings were edited in the UI

### UI hint

File:

- `LibreChat/client/src/components/Endpoints/Settings/Advanced.tsx`

Behavior:

- the prompt settings panel now shows a short notice that ROOT PROMPT is auto-injected and cannot be removed
- this is informational only; the actual enforcement happens in code

## Why This Works Better Than `librechat.yaml`

The previous YAML-based instructions were being loaded correctly by the backend, but they were not reliably reaching the active conversation because:

- frontend presets could override them
- existing conversation state could override them
- new conversation creation in the frontend has its own preset-merging behavior

This new approach works at the frontend conversation layer itself, so it is much more reliable for local product development.

## Files Changed

- `LibreChat/client/src/utils/rootPrompt.ts`
- `LibreChat/client/src/hooks/useNewConvo.ts`
- `LibreChat/client/src/hooks/Chat/useChatFunctions.ts`
- `LibreChat/client/src/components/Endpoints/Settings/Advanced.tsx`

## Current Local Dev Status

- frontend dev server verified at `http://localhost:3090`
- local workflow remains dev-first rather than production-build-first

## Root Prompt Content

The current ROOT PROMPT enforces two main behaviors:

- LaTeX formulas should be output directly as renderable math, not wrapped in `latex` code fences
- function graph requests should be output as fenced `function` blocks containing valid JSON

## Follow-Up Option

If desired, the next refinement could be to render the ROOT PROMPT as a visibly read-only block in the UI instead of only showing an informational note.
