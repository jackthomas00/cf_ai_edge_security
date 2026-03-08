# Edge Security Copilot

Edge Security Copilot is a chat-first Cloudflare MVP for analyzing suspicious requests, auth logs, firewall events, and similar operational signals at the edge.

## Deployment Shape

The intended deployment model is:

- **Cloudflare Pages** serves the frontend from the `pages/` directory.
- **Cloudflare Worker** serves the backend API from `src/worker.ts`.
- **Durable Objects** store per-session memory for the Worker API.
- **Workers AI** is called by the Durable Object for inference.

The frontend fetches `API_BASE` from a Pages Function (`/api/config`) that reads the `EDGE_SECURITY_API_BASE` env var. Set this variable in your Pages project (Settings → Variables and Secrets) to your Worker URL (e.g. `https://cf-ai-edge-security.<account>.workers.dev`).

## How To Use

### Prerequisites

- Node.js 18+
- npm
- Cloudflare account with Workers AI enabled
- Wrangler CLI (installed via project dev dependencies)

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Authenticate Wrangler (if not already logged in):

```bash
npx wrangler login
```

3. Start the Worker API locally:

```bash
npm run dev
```

4. For local frontend testing, set the Worker origin before loading the app (e.g. add to `index.html` before the app script):

```html
<script>window.EDGE_SECURITY_API_BASE = "http://127.0.0.1:8787";</script>
```

5. Serve the `pages/` directory with Cloudflare Pages or any simple static file server for local frontend testing. When served locally, `/api/config` will 404, so the app falls back to `window.EDGE_SECURITY_API_BASE` or `window.location.origin`.

### App Workflow (UI)

1. Paste a suspicious request/log/event description into **Incident / Log Input**.
2. Click **Analyze** to send it to `/api/chat`.
3. Review the assistant response in the **Conversation** panel.
4. Keep using the same browser tab/session for memory-aware follow-ups.
5. Use **New Session** to clear context and start fresh.

Notes:
- Session IDs are stored in browser `localStorage` using key `edge-security-session-id`.
- Refreshing the page reloads prior conversation for the same `sessionId`.

### API Usage (optional)

Create session:

```bash
curl -X POST http://127.0.0.1:8787/api/session
```

Send chat message:

```bash
curl -X POST "http://127.0.0.1:8787/api/chat?sessionId=<SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Analyze this auth failure burst from one IP..."}'
```

Get current session state:

```bash
curl http://127.0.0.1:8787/api/session/<SESSION_ID>
```

### Deploy

```bash
npm run deploy
```

## Implemented Today

The current implementation is intentionally narrow:

- The app is **chat-first**. A user submits a suspicious request, log line, or incident description and receives an AI-assisted analysis response.
- The **Worker** remains thin and stateless. It handles API routing, session creation, and delegation to the session Durable Object.
- The **Durable Object** owns per-session state, including chat history and incident memory for that session.
- **Workers AI** powers the analysis path and is used only for inference.
- The **Cloudflare Pages frontend** persists `sessionId` in the browser and rehydrates prior chat messages on refresh by fetching the existing session state from the Worker API.

## Planned / Future Work

The following parts of the target architecture are deferred and should not be considered part of the current MVP:

- **Real Cloudflare Workflows** for a bounded multi-step analysis pipeline
- **D1** for optional cross-session incident history
- **Vectorize** for optional semantic retrieval over past incidents
- richer retrieval and persistence beyond the current per-session Durable Object memory

## MVP scope

Today, the working request flow is:

1. A user pastes a suspicious request, log line, or incident description.
2. The Cloudflare Pages frontend calls the Worker API.
3. The Worker routes the request to the session Durable Object.
4. The Durable Object assembles the current chat context, includes compact relevant prior incident context from the same session, and calls Workers AI.
5. The Durable Object stores the user message and assistant response as session memory.
6. Refreshing the page reuses the stored `sessionId` and reloads the prior conversation from the Durable Object.
