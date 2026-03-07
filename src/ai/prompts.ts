import type { IncidentRecord } from "../types";

export const SYSTEM_PROMPT = `You are an edge security analyst. You help users understand suspicious HTTP requests, auth logs, firewall events, and configuration issues.

Respond concisely. When analyzing incidents:
1. Explain what is likely happening
2. Note confidence level (high/medium/low) and any uncertainty
3. Suggest likely root cause
4. Recommend 1-3 concrete next steps

Use prior incidents only as supporting context, not proof. Avoid overstating certainty.`;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it",
  "of", "on", "or", "that", "the", "to", "was", "were", "with",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function scoreIncident(incident: IncidentRecord, queryTokens: Set<string>): number {
  const haystackTokens = new Set(tokenize([
    incident.rawInput,
    incident.classification ?? "",
    incident.explanation ?? "",
    incident.checklist ?? "",
  ].join(" ")));

  let overlap = 0;
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) overlap += 1;
  }
  return overlap;
}

function summarizeIncident(incident: IncidentRecord): string {
  const parts = [
    incident.classification ? `classification=${truncate(incident.classification, 40)}` : null,
    incident.explanation ? `explanation=${truncate(incident.explanation, 80)}` : null,
    `raw=${truncate(incident.rawInput, 100)}`,
  ].filter(Boolean);

  return `- ${parts.join("; ")}`;
}

export function buildPriorIncidentContext(
  incidents: IncidentRecord[],
  newUserMessage: string,
  options?: { maxIncidents?: number; recentWindow?: number }
): string | null {
  if (incidents.length === 0) return null;

  const maxIncidents = options?.maxIncidents ?? 3;
  const recentWindow = options?.recentWindow ?? 8;
  const queryTokens = new Set(tokenize(newUserMessage));
  const recentIncidents = incidents.slice(-recentWindow);

  const ranked = recentIncidents
    .map((incident) => ({
      incident,
      score: scoreIncident(incident, queryTokens),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.incident.createdAt - a.incident.createdAt)
    .slice(0, maxIncidents)
    .map(({ incident }) => summarizeIncident(incident));

  if (ranked.length === 0) return null;

  return [
    "Relevant prior incidents from this session:",
    ...ranked,
    "Use them only if they genuinely help with pattern matching or comparison.",
  ].join("\n");
}

export function buildChatMessages(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  newUserMessage: string,
  priorIncidentContext?: string | null
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (priorIncidentContext) {
    messages.push({ role: "system", content: priorIncidentContext });
  }

  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: newUserMessage });

  return messages;
}
