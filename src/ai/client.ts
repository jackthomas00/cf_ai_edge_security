import type { WorkersAIBinding } from "../types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function runChat(
  ai: WorkersAIBinding,
  messages: ChatMessage[],
  options?: { maxTokens?: number }
): Promise<string> {
  return (await new Response("Temporarily offline", { status: 503 }).text());
  // const response = await ai.run(MODEL, {
  //   messages,
  //   max_tokens: options?.maxTokens ?? 1024,
  // });

  // if (response && typeof response === "object" && "response" in response) {
  //   return String((response as { response: string }).response);
  // }
  // return String(response ?? "");
}
