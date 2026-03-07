import { DurableObject } from "cloudflare:workers";
import type { ChatMessage, IncidentRecord, SessionState } from "./types";
import { SYSTEM_PROMPT, buildChatMessages, buildPriorIncidentContext } from "./ai/prompts";
import { runChat } from "./ai/client";

export interface SessionDOEnv {
  AI: import("./types").WorkersAIBinding;
  // TODO: add when D1 is configured
  // DB: D1Database;
  // TODO: add when Vectorize is configured
  // VECTORIZE_INDEX: VectorizeIndex;
}

export class SessionDO extends DurableObject<SessionDOEnv> {
  private state: SessionState;

  constructor(ctx: DurableObjectState, env: SessionDOEnv) {
    super(ctx, env);
    this.state = {
      messages: [],
      incidents: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    this.ctx.blockConcurrencyWhile(async () => {
      return this.loadState();
    });
  }

  private async loadState(): Promise<void> {
    const stored = await this.ctx.storage.get<SessionState>("state");
    if (stored) {
      this.state = stored;
    }
  }

  private async persistState(): Promise<void> {
    this.state.lastActivityAt = Date.now();
    await this.ctx.storage.put("state", this.state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/chat") {
      return this.handleChat(request);
    }
    if (request.method === "GET" && path === "/") {
      return this.handleGetState();
    }
    if (request.method === "POST" && path === "/incident") {
      return this.handleStoreIncident(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleChat(request: Request): Promise<Response> {
    const body = (await request.json()) as { message: string };
    const { message } = body;
    if (!message || typeof message !== "string") {
      return Response.json({ error: "message required" }, { status: 400 });
    }

    const history = this.state.messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant"
      )
      .map((m) => ({ role: m.role, content: m.content }));

    const priorIncidentContext = buildPriorIncidentContext(this.state.incidents, message);
    const messages = buildChatMessages(SYSTEM_PROMPT, history, message, priorIncidentContext);
    const response = await runChat(this.env.AI, messages);

    this.state.messages.push(
      { role: "user", content: message },
      { role: "assistant", content: response }
    );
    await this.persistState();

    return Response.json({ message: response });
  }

  private async handleGetState(): Promise<Response> {
    return Response.json(this.state);
  }

  private async handleStoreIncident(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      rawInput: string;
      classification?: string;
      explanation?: string;
      checklist?: string;
    };
    const incident: IncidentRecord = {
      id: crypto.randomUUID(),
      rawInput: body.rawInput,
      classification: body.classification,
      explanation: body.explanation,
      checklist: body.checklist,
      createdAt: Date.now(),
    };
    this.state.incidents.push(incident);
    await this.persistState();

    // TODO: persist to D1 when configured for cross-session history
    // if (this.env.DB) { await this.env.DB.prepare("INSERT INTO incidents ...").run(...); }

    // TODO: embed and index in Vectorize when configured for semantic search
    // if (this.env.VECTORIZE_INDEX) { await this.env.VECTORIZE_INDEX.upsert(...); }

    return Response.json(incident);
  }
}
