# PROMPTS.md

This document contains representative AI prompts used during development.

---

## 1. Initial Architecture Design

**Prompt:**
Design an AI-powered incident analysis app using Cloudflare Workers, Durable Objects, and Workers AI. 
It must support chat-based input, stateful memory, and multi-step workflow orchestration.
Propose a clean architecture.

**Outcome:**
Created an ARCHITECTURE.md file that outlines the High-level arhcitecture, workers, workflows, dataflow, etc.

---

## 2. Scaffold

**Prompt:**
Create the initial project scaffold for a Cloudflare-based app named cf_ai_edge_security.

Use this structure:

src/
  worker.ts
  session-do.ts
  workflow.ts
  ai/
    prompts.ts
    client.ts
  types.ts
pages/
  index.html
  app.js
  styles.css
wrangler.toml
package.json

Requirements:
- TypeScript for Worker-side code
- Main Worker handles routing only
- Durable Object owns per-session state
- Keep D1 and Vectorize optional and stubbed, not fully implemented yet
- Add clear TODO comments where Workflows and persistence will later connect
- Do not over-engineer
- Output production-shaped starter files, not pseudocode

**Why it mattered:**
It helped me get started quickly with building the app. Cursor overshot my goal with just building scaffold.

## 3. Audit current scaffold

**Prompt:**
Audit the current scaffold against this architecture goal:

- Worker should remain stateless and routing-focused
- Durable Object should own per-session state and chat memory
- Workers AI should be used for inference only
- Workflow should remain a bounded multi-step pipeline, not mixed into the Worker
- D1 and Vectorize should stay optional for v1

Please review the current codebase file by file and produce:
1. what is correctly aligned,
2. what is over-implemented,
3. what is missing for a clean MVP,
4. what should be deferred until after MVP.

Do not rewrite code yet. Give a concrete checklist.

**Outcome:**
We are building MVP and it should be chat-first, and right now the repo is pretending to support more than it actually does.

## 4. Cut to MVP

**Prompt:**
Apply an MVP cut to this project with these rules:

- The MVP is chat-first
- Worker stays thin and stateless
- Durable Object owns per-session state
- Workers AI is used only for inference
- D1, Vectorize, and real Cloudflare Workflows are deferred

Make the following concrete changes:
1. Remove or hide the visible workflow UI affordance from pages/index.html and pages/app.js
2. Keep the /api/workflow/run route internal or clearly marked as deferred, but do not expose it as a user-facing feature
3. Add frontend session rehydration using GET /api/session/:id
4. Persist sessionId in the browser so refresh demonstrates session memory
5. Update README.md so implemented scope is clearly separated from planned scope

Make minimal, targeted edits only. Do not redesign the whole app.

**Outcome**
The UI no longer exposes workflow as a user-facing feature: pages/index.html removes the workflow button, pages/app.js drops the workflow handler, and src/worker.ts now labels /api/workflow/run as deferred post-MVP while keeping the reserved route. The chat path remains Worker -> Durable Object -> Workers AI only.

---

## 3. Log Classification Prompt Engineering

**Prompt:**
<your final production prompt>

**Iteration Notes:**
- First attempt was too verbose
- Added structured JSON output
- Reduced hallucinated mitigations by adding constraint instructions

---

## 4. Debugging Workers AI Invocation

**Prompt:**
<your debugging prompt>