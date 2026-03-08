export async function onRequestGet(context) {
  const apiBase = context.env.EDGE_SECURITY_API_BASE ?? null;
  return Response.json({ API_BASE: apiBase });
}
