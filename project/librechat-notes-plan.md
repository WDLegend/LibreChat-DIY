# LibreChat Notes Integration

## Goal

Add a fast, Obsidian-like split-screen notebook to LibreChat with a minimal secure model:

- left side: AI chat
- right side: personal notes workspace
- per-user note isolation
- global notes tree with folders and notes
- autosave for the selected note

## Chosen Editor

- `BlockNote`

Reason:

- fastest route to a practical notes UI
- supports rich text and markdown-like note workflows
- good fit for a right-side learning notebook MVP

## Minimal Secure Model

Security is handled on the backend, not by the editor.

Current note ownership rule:

- every note belongs to `req.user.id`

Current note identity rule:

- notes and folders are private user resources
- notes can optionally reference a `conversationId`, but they are not keyed by conversation anymore

This means:

- different users cannot read each other's notes
- the notes workspace is user-scoped
- chat integration can exist without controlling note ownership

## Backend Implementation

### New Note data model

Added files:

- `LibreChat/packages/data-schemas/src/types/note.ts`
- `LibreChat/packages/data-schemas/src/schema/note.ts`
- `LibreChat/packages/data-schemas/src/models/note.ts`
- `LibreChat/packages/data-schemas/src/methods/note.ts`

Core fields:

- `userId`
- `parentId`
- `conversationId`
- `type` (`note` or `folder`)
- `title`
- `content`
- `sortOrder`
- `createdAt`
- `updatedAt`

Important index:

- indexed on `{ userId, parentId, sortOrder }`

This gives a simple and safe private notes tree per user.

### New API route

Added file:

- `LibreChat/api/server/routes/notes.js`

Mounted at:

- `/api/notes`

Current endpoints:

- `GET /api/notes`
- `GET /api/notes?conversationId=...`
- `GET /api/notes/:noteId`
- `POST /api/notes`
- `PUT /api/notes/:noteId`
- `PATCH /api/notes/:noteId/move`
- `DELETE /api/notes/:noteId`

Security rule in all handlers:

- every query is filtered by `req.user.id`

## Frontend Implementation

### Notes data access

Added file:

- `LibreChat/client/src/data-provider/Notes.ts`

This handles:

- fetch full notes tree
- fetch note by conversation
- create note or folder
- update selected note
- delete note
- React Query cache invalidation

### Notes panel UI

Added file:

- `LibreChat/client/src/components/Chat/NotesPanel.tsx`

Current behavior:

- left sidebar tree for folders and notes
- right editor pane for the selected note
- embedded `BlockNote` editor
- create folder
- create note
- delete selected note
- debounced autosave
- save status indicator
- if the current conversation is already linked to a note, that note can become the initial selection

### Split view integration

Updated files:

- `LibreChat/client/src/components/Chat/ChatView.tsx`
- `LibreChat/client/src/components/Chat/Presentation.tsx`
- `LibreChat/client/src/components/SidePanel/SidePanelGroup.tsx`

Behavior:

- chat remains on the left
- notes workspace is added on the right as a resizable pane
- existing artifacts panel support is preserved

## Dependencies Added

Frontend packages:

- `@blocknote/core`
- `@blocknote/react`
- `@blocknote/mantine`
- `@mantine/core`
- `@mantine/hooks`

## Local Development Status

Verified:

- frontend dev server at `http://localhost:3090`
- backend server at `http://localhost:3080`

## What This MVP Supports Now

- split-screen chat + notes workspace
- per-user isolated notes
- folders and notes
- global notes tree
- autosave for selected note
- create and delete note items

## Current Limitations

- no rename UI yet
- no drag-and-drop reorder yet
- no standalone full-page notes route yet
- no image upload workflow into notes yet
- no markdown export/import yet
- no sharing or collaboration

## Why This Is Safe Enough for Now

This MVP already avoids the biggest permission mistake:

- notes are not trusted from frontend user input for ownership
- ownership is derived from authenticated backend user context

That means later permission work can extend this model without replacing the current UI.

## Recommended Next Steps

1. Add rename and move interactions for notes and folders
2. Add image support inside notes
3. Add "Add to Notes" action from chat messages
4. Add drag-and-drop tree ordering
