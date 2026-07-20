/**
 * ModelClient contract — OpenAI-shaped chat + tool_calls.
 * See: docs/ARCHITECTURE.md (Core contracts), docs/NIM_CONSTRAINTS.md
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCallFunction {
  name: string;
  /** JSON string of arguments */
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: ToolCallFunction;
}

export interface Message {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** JSON Schema fragment describing a tool for the model */
export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  messages: Message[];
  tools?: ToolSchema[];
}

export interface ChatResponse {
  message: Message;
}

export interface ModelClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

/** Optional label for status UIs (e.g. "NIM meta/llama-…"). */
export function modelLabel(client: ModelClient): string {
  if ("label" in client && typeof (client as { label?: unknown }).label === "string") {
    return (client as { label: string }).label;
  }
  return "model";
}
