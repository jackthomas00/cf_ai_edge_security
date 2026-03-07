# Edge Secuirty Copilot
## Summary:
Edge Security Copilot is an AI-powered incident analysis application built on Cloudflare. It uses Workers AI for reasoning over logs and request data, Workers/Workflows for orchestration, Durable Objects for session memory, and Pages for a chat-based interface. The goal is to turn raw operational signals into fast, actionable explanations at the edge.

### **Edge Security Copilot**

A small app where a user pastes:

* an HTTP request / response
* firewall or auth logs
* a suspicious event description
* optionally a snippet of app config

Then the app:

* uses an LLM to explain what may be happening
* classifies the issue (bot traffic, auth failure, rate limiting, config bug, suspicious request pattern, etc.)
* stores the conversation + prior incidents as memory/state
* can generate a suggested mitigation checklist
* optionally runs a multi-step workflow for “analyze → summarize → recommend action”

### Frontend

Use **Pages** for a simple chat UI with:

* log input box
* optional “incident context” box
* conversation pane
* saved incidents sidebar

### LLM

Use **Llama 3.3 on Workers AI** for the main analysis path. Cloudflare docs and changelogs explicitly reference Llama 3.3 on Workers AI as a recommended model for agent-style apps. ([Cloudflare Docs][2])

### Workflow / coordination
* **Workflows** manages a multi-step pipeline:

  1. parse incident
  2. classify severity
  3. retrieve prior related memory
  4. generate explanation
  5. generate mitigation checklist
  6. persist result

### Memory / state

Best options:

* **Durable Objects** for session-level state and chat memory
* optionally **D1** for persistent incident history
* optionally **Vectorize** if you want semantic retrieval over past incidents / notes

## Recommended scope

Do **not** overbuild. You want something polished enough to demo, explain, and deploy.

### v1 scope

Build this in 3 main flows:

**1. Incident chat**
User pastes a suspicious request or auth/network event.
App returns:

* what it likely means
* confidence / uncertainty
* likely root cause
* suggested next steps

**2. Memory**
Store previous incidents and let the app say:

* “This looks similar to a previous failed-login burst”
* “This resembles a rate-limiting misconfiguration from an earlier session”

**3. Workflow mode**
Button: “Run full analysis”
This triggers a multi-step workflow and returns:

* short summary
* detailed explanation
* mitigation checklist



