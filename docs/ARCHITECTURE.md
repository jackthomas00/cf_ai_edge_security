# Edge Security Copilot — Architecture Design

A clean architecture for an AI-powered incident analysis app using Cloudflare Workers, Durable Objects, Workers AI, and Workflows.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE PAGES (Frontend)                        │
│  Chat UI │ Log Input │ Incident Context │ Conversation Pane │ Saved Incidents│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ fetch / WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKERS (API / Orchestration Layer)                   │
│  • REST endpoints for chat, incidents, workflow trigger                      │
│  • Routes requests to Durable Objects by session ID                          │
│  • Invokes Workflows for multi-step analysis                                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│ DURABLE      │    │ WORKERS AI       │    │ WORKFLOWS    │    │ D1 (opt)     │
│ OBJECTS      │    │ (Llama 3.3)      │    │ Multi-step   │    │ Incident     │
│ Session      │    │ Classification   │    │ pipeline     │    │ history      │
│ memory       │    │ Explanation      │    │ orchestration│    │              │
└──────────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ VECTORIZE (opt)   │
                    │ Semantic search   │
                    │ over past events  │
                    └──────────────────┘
```

---

## 2. Component Responsibilities

### 2.1 Workers (API Layer)

**Role:** Single entry point for all client requests. Routes to the right backend.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send message to session; returns AI response |
| `/api/session` | POST | Create new session; returns `sessionId` |
| `/api/session/:id` | GET | Get session state (conversation, incidents) |
| `/api/workflow/run` | POST | Trigger full analysis workflow |
| `/api/incidents` | GET | List saved incidents (from D1 or DO) |

**Routing logic:**
- Each request includes `sessionId` (or creates one).
- Worker fetches the Durable Object by ID: `env.SESSION_DO.get(id)`.
- All session-scoped logic is delegated to the DO.

### 2.2 Durable Objects (Session & Memory)

**Role:** Stateful, per-session storage. One DO instance per session.

**State stored:**
- `messages[]` — chat history (user + assistant)
- `incidents[]` — past incidents analyzed in this session
- `metadata` — created_at, last_activity, user preferences

**Key methods (called via `fetch` from Worker):**
- `POST /` — append user message, call Workers AI, append response, return
- `GET /` — return full conversation + incidents
- `POST /incident` — store a new incident for memory

**Why Durable Objects:**
- Strong consistency per session
- No cold-start for chat continuity
- Natural fit for “this session remembers X”

### 2.3 Workers AI (Llama 3.3)

**Role:** LLM inference for classification, explanation, and recommendations.

**Usage patterns:**
1. **Chat mode:** Single call with system prompt + conversation history + new user input.
2. **Workflow mode:** Each step can invoke a focused prompt (e.g., classify → explain → recommend).

**Input:** Structured prompt with:
- System instructions (role, output format, constraints)
- Prior incidents from memory (if any)
- Current user input (logs, request, config snippet)

**Output:** JSON when possible (e.g., `{ classification, confidence, explanation, nextSteps }`) for easier parsing.

### 2.4 Workflows (Multi-Step Orchestration)

**Role:** Reliable, durable multi-step pipeline. Survives restarts; retries on failure.

**Pipeline steps:**
1. **Parse** — Extract structured fields from raw input (IP, path, status, etc.)
2. **Classify** — Workers AI: severity, category (bot, auth, rate-limit, config, etc.)
3. **Retrieve** — Query memory (DO or Vectorize) for similar past incidents
4. **Explain** — Workers AI: generate human-readable explanation
5. **Recommend** — Workers AI: mitigation checklist
6. **Persist** — Store result in DO session + optionally D1

**Workflow API:**
- Worker receives `POST /api/workflow/run` with `sessionId` and incident payload.
- Worker creates/retrieves workflow instance, runs steps.
- Result returned via workflow completion or streaming (if supported).

### 2.5 D1 (Optional Persistent Storage)

**Role:** Cross-session incident history. “Saved incidents” across users/sessions.

**Schema (minimal):**
```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  raw_input TEXT,
  classification TEXT,
  explanation TEXT,
  checklist TEXT,
  created_at INTEGER
);
```

### 2.6 Vectorize (Optional Semantic Search)

**Role:** “This looks similar to…” — embed incident summaries, query by similarity.

- Embed incident text with Workers AI embeddings.
- Store in Vectorize index.
- At “retrieve” step, query for top-k similar incidents to inject into prompt.

---

## 3. Data Flow

### 3.1 Chat Flow (Simple)

```
User → Worker (/api/chat) → DO (by sessionId)
  → DO loads messages from state
  → DO calls Workers AI (messages + new input)
  → DO appends user + assistant messages
  → DO returns response
  → Worker returns to client
```

### 3.2 Workflow Flow (Full Analysis)

```
User → Worker (/api/workflow/run) → Workflow.create()
  → Step 1: Parse (inline or small Worker)
  → Step 2: Classify (Workers AI)
  → Step 3: Retrieve (DO or Vectorize)
  → Step 4: Explain (Workers AI)
  → Step 5: Recommend (Workers AI)
  → Step 6: Persist (DO + optional D1)
  → Workflow returns result
  → Worker returns to client
```

### 3.3 Memory Retrieval (Similar Incidents)

```
Workflow Step 3 / Chat context:
  → DO returns incidents[] from state
  → (Optional) Vectorize similarity search on incident summaries
  → Top N similar incidents injected into LLM prompt
  → LLM can say: "This resembles a previous failed-login burst..."
```

---

## 4. Session & DO Lifecycle

- **Session ID:** UUID v4, generated by Worker on `POST /api/session`.
- **DO ID:** Derived from `sessionId` (e.g., `SESSION_DO.idFromName(sessionId)`).
- **Eviction:** Rely on Cloudflare’s default DO eviction (idle timeout). Optionally persist critical state to D1 before eviction.

---

## 5. Clean Architecture Principles

| Principle | How we apply it |
|-----------|-----------------|
| **Single responsibility** | Worker = routing; DO = session state; Workflows = pipeline; Workers AI = inference |
| **Stateless API** | Worker is stateless; all state lives in DO |
| **Explicit boundaries** | REST contracts between Pages ↔ Worker; Worker ↔ DO via fetch |
| **Testability** | Worker logic testable with env mocks; DO testable in isolation |
| **Scalability** | Each session = one DO; Workflows scale per run; Workers AI is serverless |

---

## 6. Project Structure (Suggested)

```
cf_ai_edge_security/
├── src/
│   ├── worker.ts              # Main Worker entry, routes
│   ├── session-do.ts          # Durable Object: session + memory
│   ├── workflow.ts            # Workflow definition (steps)
│   ├── ai/
│   │   ├── prompts.ts         # System prompts, templates
│   │   └── client.ts          # Workers AI invocation helpers
│   └── types.ts               # Shared types
├── pages/                     # Cloudflare Pages frontend
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── wrangler.toml
├── package.json
└── docs/
    └── ARCHITECTURE.md
```

---

## 7. Technology Choices Summary

| Need | Choice | Rationale |
|------|--------|-----------|
| Chat UI | Cloudflare Pages | Simple, co-located with Workers, no extra infra |
| API | Workers | Edge-first, low latency, integrates with DO/AI/Workflows |
| Session memory | Durable Objects | Strong consistency, natural session boundary |
| LLM | Workers AI (Llama 3.3) | Agent-style, recommended by CF, no external API keys |
| Multi-step pipeline | Workflows | Durable, retriable, clear step boundaries |
| Persistent history | D1 (optional) | SQL, good for “saved incidents” |
| Semantic search | Vectorize (optional) | “Similar to past incident X” |

---

## 8. Security Considerations

- **Auth:** Add auth (e.g., Cloudflare Access, OAuth) before production.
- **Rate limiting:** Use Workers or WAF to limit chat/workflow calls per user.
- **Input sanitization:** Validate/sanitize user input before sending to LLM.
- **Secrets:** No API keys needed for Workers AI; use env bindings for D1/Vectorize if needed.

---

## 9. Next Steps

1. Implement Worker + DO skeleton with `/api/session` and `/api/chat`.
2. Add Workers AI integration with a minimal prompt.
3. Define and run the Workflow pipeline.
4. Build the Pages chat UI.
5. Add D1/Vectorize if v1 scope expands.
