# LibreChat Architecture Overview

## Project Positioning

LibreChat is an open-source, self-hosted AI chat platform built as a monorepo. It is not just a simple chat UI. It already contains:

- multi-provider model access
- custom OpenAI-compatible endpoints
- agents and MCP support
- artifacts and code rendering
- file handling and search
- auth, RBAC, and multi-user support

For secondary development, it should be understood as a platform-style application with a frontend SPA, a backend service layer, shared schema packages, and a database model layer.

## Monorepo Structure

The root `package.json` defines these npm workspaces:

- `api`
- `client`
- `packages/*`

The project uses:

- `npm workspaces`
- `turbo` for monorepo builds
- `rollup` for package compilation
- `vite` for frontend development and production builds

### Core Workspace Roles

| Workspace | Main Language | Responsibility |
|---|---|---|
| `api/` | JavaScript | Express server shell, route registration, startup wiring |
| `client/` | TypeScript + React | Main frontend SPA |
| `packages/api/` | TypeScript | Core backend business and platform logic |
| `packages/data-provider/` | TypeScript | Shared types, endpoint config, request/data helpers |
| `packages/data-schemas/` | TypeScript | MongoDB/Mongoose schemas, models, methods, app config pieces |
| `packages/client/` | TypeScript | Shared frontend components/utilities |

## High-Level Architecture

LibreChat follows a layered structure:

1. `client/` renders the SPA and talks to backend APIs
2. `api/` starts Express and wires legacy JS routes to the platform core
3. `packages/api/` contains most of the reusable backend logic
4. `packages/data-provider/` defines shared contracts between frontend and backend
5. `packages/data-schemas/` defines persistence models and app/domain configuration structures
6. MongoDB stores users, conversations, messages, prompts, agents, permissions, and related data

This means the project is already partially modularized, even though the runtime entrypoint is still the traditional Express app in `api/`.

## Root Tooling and Build System

### Main Build/Dev Tooling

- package manager: `npm`
- monorepo orchestration: `turbo`
- backend runtime: `node`
- optional alternative runtime: `bun`
- frontend bundler/dev server: `vite`
- package bundling: `rollup`
- testing: `jest`, `playwright`
- linting/formatting: `eslint`, `prettier`

### Important Root Scripts

- `npm run backend`
- `npm run backend:dev`
- `npm run frontend:dev`
- `npm run build`
- `npm run smart-reinstall`

### Runtime Defaults

- backend: `http://localhost:3080`
- frontend dev server: `http://localhost:3090`
- database: MongoDB

## Frontend Architecture

### Frontend Workspace

Path:

- `client/`

### Frontend Main Technologies

- `React 18`
- `TypeScript`
- `react-router-dom`
- `Vite`
- `Tailwind CSS`
- `Radix UI`
- `Headless UI`
- `Ariakit`
- `React Query`
- `Recoil`
- `Jotai`
- `i18next`

### Frontend Content and Rich Rendering Libraries

These are especially relevant for later educational-product secondary development:

- `react-markdown`
- `remark-gfm`
- `remark-math`
- `rehype-katex`
- `rehype-highlight`
- `mermaid`
- `@monaco-editor/react`
- `@codesandbox/sandpack-react`

This tells us LibreChat already has a mature rendering base for:

- markdown
- code blocks
- syntax highlighting
- mathematical formulas
- diagram-like artifacts
- embedded code experiences

### Frontend Interaction and UI Libraries

- `framer-motion`
- `@react-spring/web`
- `react-dnd`
- `react-resizable-panels`
- `react-virtualized`
- `react-transition-group`

These support richer visual and interaction patterns than a basic chat UI.

### Frontend Routing Layer

Main files:

- `client/src/routes/index.tsx`
- `client/src/routes/Root.tsx`
- `client/src/routes/ChatRoute.tsx`
- `client/src/routes/ShareRoute.tsx`
- `client/src/routes/Search.tsx`
- `client/src/routes/Layouts/*`

The router structure shows several application zones:

- auth flow
  - login
  - register
  - password reset
  - 2FA
  - OAuth success/error
- main app shell
  - chat
  - search
  - agents marketplace
  - dashboard
  - share pages

The main authenticated shell is built around `Root.tsx`, which mounts the sidebar, banners, context providers, and nested content.

### Chat Page Entry Flow

`client/src/routes/ChatRoute.tsx` is a key orchestration file.

Responsibilities include:

- loading startup config
- loading endpoints and model data
- resolving conversation state
- creating a new conversation when entering `/c/new`
- loading an existing conversation by ID
- managing temporary chat mode
- connecting chat rendering to providers such as tool-call maps

This is one of the most important frontend entrypoints for any future custom message rendering work.

### Frontend State Management

The frontend uses a mixed state model:

- `Recoil`
- `Jotai`
- multiple React Context providers

Important state directories:

- `client/src/store/`
- `client/src/Providers/`

Examples of managed state include:

- endpoints
- settings
- submission state
- agents
- artifacts
- favorites
- search
- language
- user state

### Frontend Providers

`client/src/Providers/index.ts` exports many providers, including:

- `ChatContext`
- `MessageContext`
- `ArtifactsContext`
- `ArtifactContext`
- `CodeBlockContext`
- `ToolCallsMapContext`
- `AssistantsContext`
- `AgentsContext`
- `PromptGroupsContext`
- `SearchContext`
- `FileMapContext`

This indicates the UI is composed around feature-scoped React contexts rather than one centralized store alone.

### Frontend Data Layer

The frontend-local API hook layer lives in:

- `client/src/data-provider/`

This includes modules like:

- `Auth`
- `Agents`
- `Endpoints`
- `Files`
- `Messages`
- `Memories`
- `MCP`
- `SSE`
- `Favorites`
- `Tools`

The project convention is to use React Query for API interaction patterns, while shared request structures come from `packages/data-provider`.

### Frontend UI Domains

Major feature component areas under `client/src/components/` include:

- `Artifacts/`
- `Agents/`
- `Web/`
- `Conversations/`
- `UnifiedSidebar/`
- `Prompts/`
- `Share/`
- `Nav/`
- `Bookmarks/`
- `ui/`

Of these, the most relevant to educational product secondary development are:

- `Artifacts/`
  - already includes `Mermaid.tsx`, code display, previews, editor-related UI
- `Web/`
  - source and citation rendering
- chat and message related components
  - useful for inserting structured learning blocks later

### Frontend Build Configuration

Main file:

- `client/vite.config.ts`

Important characteristics:

- dev server proxies `/api` and `/oauth` to backend `3080`
- PWA support enabled with `vite-plugin-pwa`
- compression enabled with `vite-plugin-compression2`
- node polyfills configured for browser compatibility
- manual chunk splitting is heavily customized for large libraries such as:
  - `mermaid`
  - `sandpack`
  - `react-virtualized`
  - markdown-related libraries
  - Monaco editor
  - form libraries
  - i18n

This suggests frontend performance and bundle control are already a concern in the architecture.

## Backend Architecture

### Runtime Entry Layer

Main file:

- `api/server/index.js`

This file is the live server bootstrapper. It is responsible for:

- loading environment variables
- booting Express
- connecting to MongoDB
- triggering background index sync
- seeding database state
- loading application configuration
- initializing file storage
- enabling auth strategies
- registering route modules
- serving the SPA fallback
- starting MCP initialization and stream services

This means `api/` is still the actual operational backend shell.

### Backend Main Technologies

- `Node.js`
- `Express 5`
- `MongoDB`
- `mongoose`
- `passport`
- `jsonwebtoken`
- `multer`
- `winston`
- `meilisearch`
- `ioredis`
- `keyv`
- `connect-redis`

### AI and Platform Integrations in Backend

- `openai`
- `@google/genai`
- `@anthropic-ai/vertex-sdk`
- `@aws-sdk/client-bedrock-runtime`
- `ollama`
- `@librechat/agents`
- `@modelcontextprotocol/sdk`
- `@langchain/core`

This confirms the backend is a provider integration platform rather than a single-vendor API wrapper.

### File and Content Processing Libraries

- `sharp`
- `pdfjs-dist`
- `mammoth`
- `xlsx`
- `file-type`
- `mathjs`

These are useful signals for future educational scenarios because the system already processes documents, files, and structured content.

### Authentication and Access Control Stack

- `passport-local`
- `passport-jwt`
- `passport-google-oauth20`
- `passport-github2`
- `passport-discord`
- `passport-facebook`
- `passport-apple`
- `openid-client`
- `jwks-rsa`
- LDAP support

This indicates the app is designed for real multi-user deployments, not only local personal usage.

### Backend Route Organization

Routes are collected in:

- `api/server/routes/index.js`

Important route groups include:

- `/api/auth`
- `/api/admin`
- `/api/actions`
- `/api/user`
- `/api/search`
- `/api/messages`
- `/api/convos`
- `/api/prompts`
- `/api/endpoints`
- `/api/models`
- `/api/config`
- `/api/assistants`
- `/api/files`
- `/api/share`
- `/api/roles`
- `/api/agents`
- `/api/memories`
- `/api/permissions`
- `/api/tags`
- `/api/mcp`

This route map shows the backend supports several platform subsystems:

- chat and conversations
- model/provider management
- permissions and roles
- assistants and agents
- file ingestion
- MCP tools and integrations
- memory and search

### Backend Service Layer in `api/server/services`

The JS service layer under `api/server/services/` includes many domains such as:

- `AuthService`
- `ActionService`
- `ToolService`
- `PermissionService`
- `GraphApiService`
- `MCP`
- `Files`
- `Config`
- `Runs`
- `Threads`
- `Artifacts`

This is the legacy/bridge service layer around the Express app.

## TypeScript Backend Core in `packages/api`

### Purpose

`packages/api/` is the long-term backend core. New backend logic is intended to live here rather than directly in `api/`.

### Main Module Areas

From `packages/api/src/index.ts`, the main domains are:

- `app`
- `auth`
- `apiKeys`
- `mcp`
- `utils`
- `oauth`
- `crypto`
- `flow`
- `middleware`
- `memory`
- `agents`
- `prompts`
- `endpoints`
- `files`
- `storage`
- `tools`
- `web`
- `cache`
- `stream`

### Architectural Meaning

This package acts as the reusable backend platform kernel. The `api/` workspace imports from it and uses it at runtime.

Important platform capabilities visible here include:

- cache abstraction
- stream/reconnect job handling
- OAuth helpers
- MCP integration
- web search
- tools registry and definitions
- storage abstraction
- auth and role logic

## Shared Contract Layer in `packages/data-provider`

### Purpose

`packages/data-provider/` is a critical shared layer between frontend and backend.

It centralizes:

- endpoint and config schemas
- request helpers
- API endpoint definitions
- shared types for messages, files, agents, assistants, runs, web, graph, mutations, and queries
- React Query support exports
- permission and role utilities

### Main Module Areas

Important files include:

- `api-endpoints.ts`
- `data-service.ts`
- `config.ts`
- `file-config.ts`
- `messages.ts`
- `artifacts.ts`
- `mcp.ts`
- `permissions.ts`
- `roles.ts`
- `keys.ts`
- `types/*`

### Why It Matters

If future secondary development introduces structured educational message blocks, shared learning schemas, graph objects, or custom artifact payloads, this package is the best place to define them.

## Persistence and Domain Model Layer in `packages/data-schemas`

### Purpose

`packages/data-schemas/` defines:

- Mongoose models
- domain types
- schema methods
- app-level config assembly
- logging utilities
- tenant context and migrations

### Main Model Areas

Examples of persistent domain models:

- `user`
- `message`
- `convo`
- `assistant`
- `agent`
- `agentCategory`
- `file`
- `memory`
- `prompt`
- `promptGroup`
- `banner`
- `balance`
- `token`
- `sharedLink`
- `mcpServer`
- `role`
- `aclEntry`

### App Configuration Support

This package also contains app configuration composition logic under:

- `src/app/*`

This includes support for:

- interface config
- endpoint config
- memory config
- OCR config
- web search config
- Vertex and Azure-related config

### Logging and Infra Helpers

- `src/config/winston.ts`
- `src/config/meiliLogger.ts`
- `src/config/tenantContext.ts`

This indicates the package is not only about models, but also about domain-aware infra concerns.

## Current Frontend/Backend Separation Pattern

LibreChat is not split into fully isolated microservices. Instead, it follows a modular monolith structure:

- one frontend SPA
- one main backend service
- several internal reusable packages

The practical separation is:

- `client/` owns rendering and browser behavior
- `api/` owns server bootstrapping and route assembly
- `packages/api/` owns reusable backend domain/platform logic
- `packages/data-provider/` owns shared contracts
- `packages/data-schemas/` owns persistence and app/domain schema logic

## Libraries Summary by Side

### Frontend

- language: `TypeScript`
- framework: `React`
- router: `react-router-dom`
- bundler/dev server: `Vite`
- styling: `Tailwind CSS`
- UI primitives: `Radix UI`, `Headless UI`, `Ariakit`
- state: `Recoil`, `Jotai`, React Context
- data fetching: `React Query`, partial `SWR`
- markdown and formula: `react-markdown`, `remark-math`, `rehype-katex`, `rehype-highlight`
- artifacts/visuals: `Mermaid`, `Monaco`, `Sandpack`
- animation and interaction: `framer-motion`, `@react-spring/web`, `react-dnd`
- i18n: `i18next`

### Backend

- language: `JavaScript` in `api/`, `TypeScript` in `packages/api/`
- server: `Express`
- database: `MongoDB`, `mongoose`
- auth: `passport`, `openid-client`, JWT stack
- cache/session/search: `Redis`, `Keyv`, `Meilisearch`
- AI providers: `OpenAI`, `Google`, `Anthropic Vertex`, `Bedrock`, `Ollama`
- agent/tool framework: `@librechat/agents`, `@modelcontextprotocol/sdk`, `@langchain/core`
- file processing: `multer`, `sharp`, `pdfjs-dist`, `mammoth`, `xlsx`
- validation/config: `zod`, `js-yaml`

## Suggested Secondary Development Entry Points

For turning LibreChat into a learning product, the most important code areas are:

### Frontend Entry Points

- `client/src/routes/ChatRoute.tsx`
- `client/src/components/Artifacts/`
- `client/src/components/Web/`
- chat/message rendering related components
- `client/src/Providers/`

### Shared Schema Entry Points

- `packages/data-provider/src/types/*`
- `packages/data-provider/src/artifacts.ts`
- `packages/data-provider/src/messages.ts`
- `packages/data-provider/src/config.ts`

### Backend Entry Points

- `api/server/services/Config/*`
- `packages/api/src/endpoints/*`
- `packages/api/src/tools/*`
- `packages/api/src/files/*`
- `packages/api/src/stream/*`

## Secondary Development Guidance for an Educational Product

LibreChat is a strong base if the target is a learning assistant, because it already supports:

- markdown rendering
- math formula rendering
- mermaid and artifact rendering
- multi-model configuration
- user accounts and permissions
- structured provider config via YAML

The likely upgrade path is:

1. extend frontend message rendering
2. introduce custom educational blocks such as function plots, trees, and knowledge graphs
3. define shared block schemas in `packages/data-provider`
4. add persistence or service logic only when needed

For this reason, LibreChat should be viewed less as a chat clone and more as a customizable AI application platform.
