/**
 * Offline ModelClient with scripted turns for classroom demos (no API key).
 * See: docs/TURN_LOOP.md, docs/NIM_CONSTRAINTS.md (Modes)
 */

import type { ChatRequest, ChatResponse, ModelClient, Message } from "./types.js";

/**
 * Script:
 *  1) First user turn → tool call read_file on README.md (or echo path)
 *  2) After tool result → short final reply summarizing
 *  3) Later turns → text-only reply
 */
export class MockClient implements ModelClient {
  readonly label = "mock";
  private step = 0;

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const last = request.messages[request.messages.length - 1];

    // After a tool result, finish the scripted tool round
    if (last?.role === "tool") {
      this.step += 1;
      return {
        message: {
          role: "assistant",
          content:
            "Mock model: I read the file via the tool. (This is MockClient — use --model nim for a real model.)",
        },
      };
    }

    // First assistant response in a fresh conversation: demonstrate a tool call
    if (this.step === 0 && !hasPriorAssistant(request.messages)) {
      this.step = 1;
      return {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "mock_call_1",
              type: "function",
              function: {
                name: "read_file",
                arguments: JSON.stringify({ path: "README.md" }),
              },
            },
          ],
        },
      };
    }

    const userText = last?.role === "user" ? (last.content ?? "") : "";
    return {
      message: {
        role: "assistant",
        content: `Mock model reply to: ${truncate(userText, 120)}`,
      },
    };
  }

  /** Reset scripted state (e.g. after /clear) */
  reset(): void {
    this.step = 0;
  }
}

function hasPriorAssistant(messages: Message[]): boolean {
  return messages.some((m) => m.role === "assistant");
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}
