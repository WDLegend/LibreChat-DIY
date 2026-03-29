# LibreChat Local Install Skill

## Goal

Run `LibreChat` locally for secondary development, while allowing infrastructure dependencies such as MongoDB to use Docker. Keep the main app in local Node.js development mode and connect it to a custom OpenAI-compatible endpoint.

## Final Working Setup

- Repo path: `/Users/whoamipriv/work/opencode/LibreChat`
- Frontend dev URL: `http://localhost:3090`
- Backend URL: `http://localhost:3080`
- Health check: `http://localhost:3080/health`
- MongoDB: Docker container `librechat-mongo` on `localhost:27017`
- Custom endpoint name: `VPSAI`
- Custom endpoint base URL: `https://fast.vpsairobot.com/v1`
- Default model: `openai/gpt-5.4`
- Working Node version: `v20.19.1`

## What Was Configured

### 1. Clone the repository

```bash
cd /Users/whoamipriv/work/opencode
git clone https://github.com/danny-avila/LibreChat.git
```

### 2. Start MongoDB with Docker

Main app stays local, database runs in Docker.

```bash
docker run -d --name librechat-mongo -p 27017:27017 mongo:8.0.20 mongod --noauth
```

Verify:

```bash
mongosh --quiet --eval "db.runCommand({ ping: 1 })"
```

### 3. Use a supported Node version

LibreChat did not build correctly on the machine's default Node `v21.7.3`.
Vite and parts of the workspace require `v20.19+` or `v22.12+`.

```bash
source ~/.nvm/nvm.sh
nvm install 20.19.1
nvm use 20.19.1
node -v
npm -v
```

### 4. Copy and adjust `.env`

Create the local runtime config:

```bash
cd /Users/whoamipriv/work/opencode/LibreChat
cp .env.example .env
```

Important edits made in `LibreChat/.env`:

```env
ENDPOINTS=custom
SEARCH=false
MEILI_HOST=
MEILI_MASTER_KEY=
VPSAI_API_KEY=<your key>
```

Why:

- `ENDPOINTS=custom` keeps the UI focused on the custom provider
- `SEARCH=false` disables the Meilisearch-backed search feature for local setup
- clearing `MEILI_HOST` and `MEILI_MASTER_KEY` prevents startup noise and failed Meili requests
- `VPSAI_API_KEY` is used by the custom endpoint config in YAML

### 5. Add `librechat.yaml`

Created `LibreChat/librechat.yaml`:

```yaml
version: 1.3.6
cache: true

endpoints:
  custom:
    - name: 'VPSAI'
      apiKey: '${VPSAI_API_KEY}'
      baseURL: 'https://fast.vpsairobot.com/v1'
      models:
        default:
          - 'openai/gpt-5.4'
        fetch: false
      titleConvo: true
      titleModel: 'openai/gpt-5.4'
      modelDisplayLabel: 'VPS AI'
      dropParams:
        - 'stop'
```

Why:

- this is the cleanest way to connect LibreChat to an OpenAI-compatible endpoint
- `models.fetch: false` avoids relying on the provider's model-list endpoint
- `dropParams: ['stop']` is a safe compatibility choice for gateway-style providers

## Install and Build Steps

### 6. Install dependencies

The workspace install command used was:

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm run smart-reinstall
```

Because the first build attempt happened under the wrong Node version, a rebuild was then run under Node `20.19.1`:

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm run build
```

### 7. Reinstall frontend workspace dependencies

To stabilize local dev for the client workspace:

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm install --workspace client
```

## Problems Encountered and How They Were Resolved

### Problem 1: Wrong Node version

Symptoms:

- Vite build failed
- warnings showed unsupported Node engine
- frontend build broke while processing PostCSS and Vite build steps

Fix:

- switched from `v21.7.3` to `v20.19.1` via `nvm`

### Problem 2: Backend failed with missing runtime modules during local startup

When running the backend locally, several modules were reported as missing one after another.
This happened because the monorepo runtime expected some packages to be resolvable from the root during direct local execution.

Errors seen included:

- `Cannot find module 'winston-daily-rotate-file'`
- `Cannot find module '@opentelemetry/core'`
- `Cannot find module '@opentelemetry/exporter-trace-otlp-http'`
- `Cannot find module 'object-hash'`

Fix:

Installed the missing runtime dependencies at the workspace root for local dev resolution:

```bash
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm install --no-save object-hash framer-motion @react-spring/web winston-daily-rotate-file @opentelemetry/core @opentelemetry/exporter-trace-otlp-http
```

Why this worked:

- the backend and frontend were both being started from the monorepo root
- some generated or linked workspace packages expected these modules to be found during runtime resolution
- adding them at root fixed local execution without changing application source code

### Problem 3: Frontend dev server started but dependency scan failed

Symptoms:

- Vite started on `3090`
- dependency scan complained that `framer-motion` and `@react-spring/web` could not be resolved from `packages/client/dist/index.es.js`

Fix:

- installed those dependencies at the root in addition to the client workspace
- restarted the Vite dev server

Result:

- frontend dev server started cleanly
- no unresolved dependency warnings remained in the final log

### Problem 4: Meilisearch-related errors even with local-only setup

Symptoms:

- startup logs showed `mongoMeili` fetch failures

Cause:

- `SEARCH=false` alone was not enough while `MEILI_HOST` and `MEILI_MASTER_KEY` were still present

Fix:

- cleared both values in `.env`

Result:

- backend started cleanly without Meili connectivity noise

## Start Commands

### Backend

```bash
cd /Users/whoamipriv/work/opencode/LibreChat
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm run backend
```

### Frontend

```bash
cd /Users/whoamipriv/work/opencode/LibreChat
source ~/.nvm/nvm.sh
nvm use 20.19.1
npm run frontend:dev
```

## Optional Background Start Commands

Backend:

```bash
nohup npm run backend > /tmp/librechat-backend.log 2>&1 &
```

Frontend:

```bash
nohup npm run frontend:dev > /tmp/librechat-frontend.log 2>&1 &
```

## Validation Checklist

### Backend

```bash
lsof -iTCP:3080 -sTCP:LISTEN
curl http://localhost:3080/health
```

Expected:

- process is listening on port `3080`
- health endpoint returns `OK`

### Frontend

```bash
lsof -iTCP:3090 -sTCP:LISTEN
```

Expected:

- Vite is listening on port `3090`
- opening `http://localhost:3090` shows the LibreChat UI

### MongoDB

```bash
docker ps --format '{{.Names}} {{.Status}}'
mongosh --quiet --eval "db.runCommand({ ping: 1 })"
```

Expected:

- `librechat-mongo` is running
- Mongo ping returns `{ ok: 1 }`

## Files Changed During Setup

- `LibreChat/.env`
- `LibreChat/librechat.yaml`

## Notes for Future Local Development

- open the app through `http://localhost:3090` for frontend work
- backend API remains on `http://localhost:3080`
- if you pull new changes, re-run install/build under Node `20.19.1`
- the current `.env` still uses example secrets for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDS_KEY`, and `CREDS_IV`; replace them before longer-term use
- RAG/file-upload features are not fully configured in this setup, which is acceptable for chat-focused local development

## Recommended Next Step for This Project

If the goal is to turn LibreChat into a learning assistant, inspect these next:

- message rendering entry points in `client/`
- Markdown and code block renderers
- where custom content blocks could be inserted for formulas, function graphs, trees, and knowledge graphs
