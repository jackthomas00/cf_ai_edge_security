# Edge Security Copilot

Edge Security Copilot is a chat-first Cloudflare MVP for analyzing suspicious requests, auth logs, firewall events, and similar operational signals at the edge.

## Implemented Today

The current implementation is intentionally narrow:

- The app is **chat-first**. A user submits a suspicious request, log line, or incident description and receives an AI-assisted analysis response.
- The **Worker** remains thin and stateless. It handles request routing, session creation, and delegation to the session Durable Object.
- The **Durable Object** owns per-session state, including chat history and incident memory for that session.
- **Workers AI** powers the analysis path and is used only for inference.
- The frontend persists `sessionId` in the browser and rehydrates prior chat messages on refresh by fetching the existing session state.

## Planned / Future Work

The following parts of the target architecture are deferred and should not be considered part of the current MVP:

- **Real Cloudflare Workflows** for a bounded multi-step analysis pipeline
- **D1** for optional cross-session incident history
- **Vectorize** for optional semantic retrieval over past incidents
- richer retrieval and persistence beyond the current per-session Durable Object memory

## MVP scope

Today, the working request flow is:

1. A user pastes a suspicious request, log line, or incident description.
2. The Worker routes the request to the session Durable Object.
3. The Durable Object assembles the current chat context, includes compact relevant prior incident context from the same session, and calls Workers AI.
4. The Durable Object stores the user message and assistant response as session memory.
5. Refreshing the page reuses the stored `sessionId` and reloads the prior conversation from the Durable Object.
