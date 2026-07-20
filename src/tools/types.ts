/**
 * Tool contract — name, JSON-schema params, execute → ToolResult.
 * Schemas go to the model; execute() runs locally. See: docs/TOOLS.md
 */

export interface ToolContext {
  workspaceRoot: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema object for function parameters */
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
