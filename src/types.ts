/** Minimal interface for Workers AI binding */
export interface WorkersAIBinding {
  run(
    model: string,
    options: { messages: { role: string; content: string }[]; max_tokens?: number }
  ): Promise<{ response?: string } | string>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface IncidentRecord {
  id: string;
  rawInput: string;
  classification?: string;
  explanation?: string;
  checklist?: string;
  createdAt: number;
}

export interface SessionState {
  messages: ChatMessage[];
  incidents: IncidentRecord[];
  createdAt: number;
  lastActivityAt: number;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  message: string;
}

export interface WorkflowInput {
  sessionId: string;
  rawInput: string;
  context?: string;
}

export interface WorkflowResult {
  summary: string;
  explanation: string;
  checklist: string[];
}
