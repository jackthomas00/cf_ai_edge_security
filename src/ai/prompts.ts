export const SYSTEM_PROMPT = `You are an edge security analyst. You help users understand suspicious HTTP requests, auth logs, firewall events, and configuration issues.

Respond concisely. When analyzing incidents:
1. Explain what is likely happening
2. Note confidence level (high/medium/low) and any uncertainty
3. Suggest likely root cause
4. Recommend 1-3 concrete next steps

If the user provides prior similar incidents for context, reference them when relevant.`;

export function buildChatMessages(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  newUserMessage: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: newUserMessage });

  return messages;
}
