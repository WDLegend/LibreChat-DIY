# LibreChat Learning Mode (MVP) Notes

## Goal

Add a guided learning mode where users can ask to learn a topic (e.g., calculus), receive a structured learning map, mark mastered nodes, and progress step-by-step with AI explanations.

## What Was Implemented

### 1) Learning Mode Toggle

- Added a chat badge: `Learning Mode`
- Uses Recoil atom state:
  - `learningMode` (boolean)
- Files:
  - `client/src/store/misc.ts`
  - `client/src/hooks/useChatBadges.ts`
  - `client/src/locales/en/translation.json`

### 2) Learning Tree Rendering in Chat

- Added fenced block type: ```` ```learning-tree ````
- Backward compatible parsing for legacy labels:
  - `learning-map`
  - `learning_map`
  - `learningmap`
- JSON schema expected:
  - `title?: string`
  - `nodes: { id: string; label: string; parentId?: string }[]`
  - `edges?: { from: string; to: string }[]`
- If `edges` is omitted, `parentId` relationships are converted into tree edges.
- Added renderer component with interactive node check/uncheck:
  - `client/src/components/Messages/Content/LearningMap.tsx`
- Integrated block routing:
  - `client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`

### 3) Learning State Model

- Added shared frontend types:
  - `client/src/types/learning.ts`
- Added utility helpers:
  - parse learning map payload
  - compute topological order
  - compute next node
  - detect continue intent (CN + EN)
  - `client/src/utils/learning.ts`
- Added persisted state (localStorage-backed Recoil atom):
  - `learningMapState`
  - `client/src/store/misc.ts`

### 3.1) Learning Mode Toggle Behavior

- Learning mode can now be toggled at any time (including mid-conversation).
- Removed old in-chat disable behavior from badge component.
- Files:
  - `packages/client/src/components/Badge.tsx`
  - rebuilt `@librechat/client` dist

### 4) Continue-Driven Progression

- In learning mode, progression is now button-driven (explicit controls) instead of loose keyword matching.
- Buttons are rendered in a sticky learning control bar near the chat input (always visible during long conversations):
  - `I got it, continue` → mark current node (and prerequisites) as mastered, then advance.
  - `Learn <child-node>` path buttons → select which branch to learn next when multiple children exist.
- Node click behavior:
  - Clicking a node marks that node and all prerequisite ancestors as mastered.
  - This avoids manually checking every previous prerequisite.
  - Clicking the same node again cancels that manual operation (undo by second click).
- Additional safety:
  - `Undo` button in control bar restores the last manual selection snapshot.
- Implemented in:
  - `client/src/hooks/Chat/useChatFunctions.ts`
  - `client/src/components/Messages/Content/LearningMap.tsx`
  - `client/src/components/Chat/LearningControlBar.tsx`
  - `client/src/utils/learning.ts`

#### Continue Intent Keywords (Legacy / Fallback)

- English:
  - `continue`, `next`, `go on`, `got it`, `ok`, `okay`, `all right`, `move on`, `carry on`
- Chinese:
  - `继续`, `下一步`, `下一节`, `下一点`, `继续讲`, `懂了`, `明白了`, `我明白了`, `我理解了`, `理解了`, `知道了`, `可以了`, `好的`, `好`, `行`, `ok`, `接着讲`, `往下`
- Source of truth (kept as fallback compatibility):
  - `client/src/utils/learning.ts` (`CONTINUE_PATTERNS`)

### 5) Prompting Rules for Learning Mode

- Base root prompt now mentions `learning-map` output support.
- Learning-mode runtime prompt injection adds context:
  - current map title
  - mastered nodes
  - next node to teach
- Implemented in:
  - `client/src/utils/rootPrompt.ts`
  - `client/src/hooks/Chat/useChatFunctions.ts`

### 6) Notes Panel Learning Progress Preview

- Right-side notes panel now shows a compact learning progress card when `learningMapState` exists.
- Includes:
  - progress bar
  - edge preview lines
  - maximize/minimize modal for enlarged view
- Implemented in:
  - `client/src/components/Chat/NotesPanel.tsx`

## UX Behavior (Current)

1. User enables `Learning Mode` badge.
2. User asks to learn a topic.
3. AI should output `learning-tree` block first.
4. User checks mastered nodes directly in the rendered map.
5. User says `继续` / `next` / similar intent.
6. System advances to next node and updates right-side progress preview.

## Prompt Rules (Learning Tree)

- The model is instructed to output a **prerequisite knowledge tree** (not a flat map/list).
- Preferred fenced block:

```text
```learning-tree
{ ...json... }
```
```

- Recommended node schema:
  - `id: string`
  - `label: string` (preferred)
  - `parentId?: string`
- Compatibility:
  - Parser accepts `title` as fallback for `label` in nodes.
  - `edges` optional; if omitted, `parentId` relationships are converted to tree edges.

## Design Constraints Followed

- Kept UI style aligned with existing LibreChat patterns (border, surface, hover, compact controls).
- No new backend API/model introduced for MVP.
- State persistence uses frontend localStorage atom to avoid backend migration overhead.

## Known Limits / Next Iteration

- Learning progress is currently frontend-persisted (localStorage), not server-synced.
- Map visualization is a compact interactive list + dependency preview, not full force-directed graph.
- No dedicated timeline/history view yet.
- Suggested next step: sync `learningMapState` into note content for cross-device persistence.

## Conversation Isolation Update

- Learning tree state is now isolated per conversation.
- `learningMapState` includes `conversationId` and UI components only render controls/previews when IDs match current route conversation.
- New conversations no longer inherit old tree progress (prevents accidental auto-green nodes).
- Files:
  - `client/src/types/learning.ts`
  - `client/src/components/Messages/Content/LearningMap.tsx`
  - `client/src/components/Chat/LearningControlBar.tsx`
  - `client/src/components/Chat/NotesPanel.tsx`
  - `client/src/hooks/Chat/useChatFunctions.ts`

## Backend Persistence Update (Learning State)

- Added server-side persistence for learning progress under Notes API.
- New routes:
  - `GET /api/notes/learning-state?conversationId=<id>`
  - `PUT /api/notes/learning-state`
- Stored payload includes:
  - `conversationId`
  - `selectedNodeIds`
  - `currentNodeId`
  - `updatedAt`
- Learning state is associated with the conversation's note owner (`userId` scoped).

### Backend changes

- Note schema now supports `learningState`:
  - `packages/data-schemas/src/schema/note.ts`
  - `packages/data-schemas/src/types/note.ts`
  - `packages/data-schemas/src/methods/note.ts`
  - `api/server/routes/notes.js`

### Frontend sync behavior

- On render of a learning tree in a conversation:
  - fetch persisted state from backend
  - merge/apply if newer (`updatedAt`)
- On local state update:
  - debounce save (`PUT /api/notes/learning-state`)
- Files:
  - `client/src/components/Messages/Content/LearningMap.tsx`
  - `client/src/data-provider/Notes.ts`
  - `packages/data-provider/src/api-endpoints.ts`
  - `packages/data-provider/src/data-service.ts`

## Current Node Teaching Guard

- Prompt now explicitly tells AI to teach **only** the current node and not jump to sibling branches unless the user selects one.
- File:
  - `client/src/hooks/Chat/useChatFunctions.ts`

### Continue Button Hard Constraint

- Continue button now sends an explicit token with node id:
  - `__LEARNING_NEXT__:<currentNodeId>`
- Prompt context treats this node id as authoritative for the response.
- Continue now advances via state-machine transition:
  - mark current node mastered
  - if 0 unmastered children: fallback to next global unmastered node
  - if 1 unmastered child: auto move to that child
  - if >1 unmastered children: stay and set `awaitingBranchChoice=true`, user must choose branch
- If token node id and local current node are out of sync, progression update is ignored (guard).

### Continue State Machine Sync Fix

- Fixed `continue` progression so state transitions stay aligned with the current node and its active branch context.
- New behavior:
  - if current node has multiple eligible unmastered children, `continue` no longer jumps to a global frontier node; it enters `awaitingBranchChoice` and waits for explicit branch selection
  - if current node has one eligible child, it advances to that child
  - only when the current node has no eligible child does it fall back to the next global frontier node
- `pendingBranchFromId` / `focusRootId` are now preserved more consistently across continue, branch selection, and undo, so the control bar and prompt stay pointed at the same branch root.

### Branch Candidate Algorithm Rewrite

- Rewrote branch candidate calculation around all currently mastered nodes.
- Candidate filtering now:
  - collects unmastered child nodes from all green/mastered nodes
  - removes duplicates deterministically
  - preserves topological order
  - excludes nodes whose prerequisites are not all mastered yet
- This prevents unrelated sibling branches and multi-parent nodes from appearing as premature branch options.

### Validation

- Added focused frontend unit tests for learning progression helpers:
  - `client/src/utils/learning.spec.ts`
- Verified:
  - branch split enters `awaitingBranchChoice`
  - current-branch advancement stays synchronized before falling back globally
  - branch candidates are deduplicated and prerequisite-filtered

### Current Node Rollback Fix

- Fixed case like `A -> B -> C` where `A/B` are green and `C` is blue; if user unselects `B`, blue now rolls back to `B` (or nearest valid unmastered current) consistently.
- Implemented by `resolveCurrentNode(...)` with preferred rollback node on deselection.
- Files:
  - `client/src/utils/learning.ts`
  - `client/src/components/Chat/LearningControlBar.tsx`
  - `client/src/hooks/Chat/useChatFunctions.ts`

## Selection / Undo Algorithm Update

- Problem addressed:
  - In chains like `A -> B -> C`, selecting `C` auto-masters `A` and `B` (by prerequisite closure).
  - Previous undo behavior could become inconsistent when toggling selected descendants.

- Current algorithm (contest-style path coverage counting):
  - Keep two sets in state:
    - `selectedNodeIds` (explicit user-selected mastery anchors)
    - `coverCount` per node (how many selected root->node paths cover this node)
    - `masteredNodeIds` derived from `coverCount > 0`
  - Recompute `coverCount` from `selectedNodeIds` and the tree parent map every time (deterministic, no drift).
  - Clicking a node toggles it in `selectedNodeIds`; prerequisites are re-derived deterministically.
  - Clicking the same node again cancels that selection correctly.
  - `Undo` restores prior snapshot including `selectedNodeIds`, `coverCount`, and `masteredNodeIds`.

- Files:
  - `client/src/types/learning.ts`
  - `client/src/utils/learning.ts`
  - `client/src/components/Messages/Content/LearningMap.tsx`
  - `client/src/components/Chat/LearningControlBar.tsx`
  - `client/src/hooks/Chat/useChatFunctions.ts`
