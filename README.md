# Edge Security Copilot

Edge Security Copilot is a chat-first Cloudflare app for analyzing suspicious requests, auth logs, firewall events, and similar operational signals.

## Implemented now

The current scaffold intentionally keeps the MVP small:

- **Pages UI** provides a simple chat interface for pasting incident data.
- **Worker** stays thin and stateless, handling routing plus session creation.
- **Durable Object** owns per-session chat state and conversation memory.
- **Workers AI** is used only for inference on the current chat path.
- **Browser session persistence** keeps the `sessionId` across refresh so the same DO-backed conversation can be rehydrated.

## Planned after MVP

These pieces are part of the target architecture, but are not user-facing in the current MVP:

- **Workflows** for a bounded multi-step analysis pipeline
- **D1** for optional cross-session incident history
- **Vectorize** for optional semantic retrieval over past incidents
- richer incident memory and retrieval beyond the basic chat transcript

## MVP scope

For v1, the primary flow is:

1. A user pastes a suspicious request, log line, or incident description.
2. The Worker routes the request to the session Durable Object.
3. The Durable Object sends the chat context to Workers AI and stores the response.
4. Refreshing the page keeps the same session and reloads the conversation.
