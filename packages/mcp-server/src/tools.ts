import type { IotaAgent, SponsoredActionResult } from "@vallum/sdk";
import { validateAgentTransactionManifest, type AgentTransactionManifest } from "@vallum/manifest";

export const REQUEST_SPONSORED_TRANSACTION_TOOL = "iota.request_sponsored_transaction";
export const OPEN_ESCROW_TOOL = "iota.open_escrow";

export type IotaMcpToolName =
  | typeof REQUEST_SPONSORED_TRANSACTION_TOOL
  | typeof OPEN_ESCROW_TOOL;

export interface IotaMcpToolDescriptor {
  readonly name: IotaMcpToolName;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
}

export interface JsonSchemaObject {
  readonly type: "object";
  readonly additionalProperties?: boolean;
  readonly required?: readonly string[];
  readonly properties: Record<string, JsonSchemaProperty>;
}

export type JsonSchemaProperty =
  | {
      readonly type: "object";
      readonly description?: string;
      readonly additionalProperties?: boolean;
    }
  | {
      readonly type: "string";
      readonly description?: string;
    };

export interface IotaMcpToolCallResult {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
  readonly structuredContent: Record<string, unknown>;
  readonly isError: boolean;
}

export interface IotaMcpToolHandlerOptions {
  readonly agent: Pick<IotaAgent, "requestSponsoredAction">;
  readonly now?: () => Date;
}

type JsonRecord = Record<string, unknown>;

export const IOTA_MCP_TOOLS: readonly IotaMcpToolDescriptor[] = [
  {
    name: REQUEST_SPONSORED_TRANSACTION_TOOL,
    title: "Request sponsored IOTA transaction",
    description: "Submit an Agent Transaction Manifest through the Vallum SDK and policy gateway.",
    inputSchema: manifestToolInputSchema(),
  },
  {
    name: OPEN_ESCROW_TOOL,
    title: "Open sponsored escrow",
    description: "Submit an escrow Agent Transaction Manifest through the Vallum SDK and policy gateway.",
    inputSchema: manifestToolInputSchema(),
  },
];

export async function callIotaMcpTool(
  name: string,
  input: unknown,
  options: IotaMcpToolHandlerOptions,
): Promise<IotaMcpToolCallResult> {
  if (!isIotaMcpToolName(name)) {
    return errorResult("UNKNOWN_TOOL", `Unknown IOTA MCP tool: ${name}`);
  }

  const manifestResult = manifestInput(input, options.now);
  if (!manifestResult.ok) {
    return errorResult("INVALID_TOOL_INPUT", manifestResult.message);
  }

  const result = await options.agent.requestSponsoredAction({
    manifest: manifestResult.manifest,
  });

  return successResult(result);
}

export function isIotaMcpToolName(name: string): name is IotaMcpToolName {
  return name === REQUEST_SPONSORED_TRANSACTION_TOOL || name === OPEN_ESCROW_TOOL;
}

function manifestToolInputSchema(): JsonSchemaObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["manifest"],
    properties: {
      manifest: {
        type: "object",
        description: "Agent Transaction Manifest to submit through the policy gateway.",
        additionalProperties: true,
      },
    },
  };
}

function manifestInput(
  input: unknown,
  now?: () => Date,
):
  | { readonly ok: true; readonly manifest: AgentTransactionManifest }
  | { readonly ok: false; readonly message: string } {
  const record = asRecord(input);
  if (!record) return { ok: false, message: "Tool input must be a JSON object." };
  const manifest = asRecord(record.manifest);
  if (!manifest) return { ok: false, message: "Tool input must include a manifest object." };
  const validation = validateAgentTransactionManifest(manifest, { now: now?.() });
  if (!validation.ok) return { ok: false, message: "Tool manifest failed validation." };
  return { ok: true, manifest: validation.manifest };
}

function successResult(result: SponsoredActionResult): IotaMcpToolCallResult {
  if (!result.approved) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: result.decision.message,
      }],
      structuredContent: {
        error: {
          code: result.decision.reasonCode,
          message: result.decision.message,
        },
        decision: result.decision,
      },
    };
  }

  return {
    isError: false,
    content: [{
      type: "text",
      text: JSON.stringify(result),
    }],
    structuredContent: result,
  };
}

function errorResult(code: string, message: string): IotaMcpToolCallResult {
  return {
    isError: true,
    content: [{
      type: "text",
      text: message,
    }],
    structuredContent: {
      error: { code, message },
    },
  };
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}
