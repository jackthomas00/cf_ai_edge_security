import { SessionDO } from "./session-do";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { WorkersAIBinding } from "./types";

export interface Env {
  AI: WorkersAIBinding;
  SESSION_DO: DurableObjectNamespace<SessionDO>;
  // TODO: add when D1 is configured
  // DB: D1Database;
  // TODO: add when Workflows is configured
  // INCIDENT_WORKFLOW: Workflow;
}

export { SessionDO };

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    // POST /api/session - create new session
    if (request.method === "POST" && path === "/api/session") {
      const sessionId = crypto.randomUUID();
      return Response.json({ sessionId }, { headers: corsHeaders() });
    }

    // POST /api/chat - send message to session
    if (request.method === "POST" && path === "/api/chat") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return Response.json({ error: "sessionId required" }, {
          status: 400,
          headers: corsHeaders(),
        });
      }
      const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(sessionId));
      const doUrl = new URL("/chat", request.url);
      const doRequest = new Request(doUrl.toString(), {
        method: "POST",
        body: request.body,
        headers: request.headers,
      });
      const doResponse = await stub.fetch(doRequest);
      return addCors(doResponse);
    }

    // GET /api/session/:id - get session state
    if (request.method === "GET" && path.startsWith("/api/session/")) {
      const sessionId = path.replace("/api/session/", "").split("/")[0];
      if (!sessionId) {
        return Response.json({ error: "sessionId required" }, {
          status: 400,
          headers: corsHeaders(),
        });
      }
      const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(sessionId));
      const doRequest = new Request(new URL("/", request.url), { method: "GET" });
      const doResponse = await stub.fetch(doRequest);
      return addCors(doResponse);
    }

    // POST /api/workflow/run - deferred internal route for post-MVP workflow work
    if (request.method === "POST" && path === "/api/workflow/run") {
      // Deferred for MVP: keep the route reserved, but do not expose it in the UI.
      // TODO: when Workflows is in scope, create and run the workflow here.
      // const body = await request.json();
      // const instance = await env.INCIDENT_WORKFLOW.create({ params: body });
      // return Response.json({ instanceId: instance.id }, { headers: corsHeaders() });
      return Response.json(
        { error: "Workflow is deferred until after the chat-first MVP." },
        { status: 501, headers: corsHeaders() }
      );
    }

    // GET /api/incidents - list saved incidents (optional, from D1)
    if (request.method === "GET" && path === "/api/incidents") {
      // TODO: when D1 is configured, query incidents table
      // if (env.DB) { const result = await env.DB.prepare("SELECT * FROM incidents ...").all(); return Response.json(result); }
      return Response.json([] as unknown[], { headers: corsHeaders() });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function corsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function addCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
