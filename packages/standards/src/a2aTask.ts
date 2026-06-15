import {
  validateAgentTransactionManifest,
  type AgentTransactionManifest,
} from "@agentrail/manifest";
import {
  evaluateAgentActionPolicy,
  type AgentActionPolicy,
  type AgentPolicyDecision,
} from "@agentrail/policy-gateway";

export const A2A_TASK_PROTOCOL_VERSION = "1.0" as const;
export const A2A_TASK_MEDIA_TYPE = "application/a2a+json" as const;

export type A2ARole = "ROLE_USER" | "ROLE_AGENT";
export type A2ATaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_REJECTED";

export interface A2APart {
  readonly text?: string;
  readonly data?: Record<string, unknown>;
  readonly file?: {
    readonly uri?: string;
    readonly bytes?: string;
    readonly filename?: string;
    readonly mediaType?: string;
  };
}

export interface A2AMessage {
  readonly messageId: string;
  readonly role: A2ARole;
  readonly parts: readonly A2APart[];
  readonly taskId?: string;
  readonly contextId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface A2AArtifact {
  readonly artifactId: string;
  readonly name?: string;
  readonly parts: readonly A2APart[];
  readonly metadata?: Record<string, unknown>;
}

export interface A2ATaskStatus {
  readonly state: A2ATaskState;
  readonly timestamp: string;
  readonly message?: A2AMessage;
}

export interface A2ATask {
  readonly id: string;
  readonly contextId: string;
  readonly status: A2ATaskStatus;
  readonly history: readonly A2AMessage[];
  readonly artifacts?: readonly A2AArtifact[];
  readonly agenticAgentRail?: {
    readonly manifestId: string;
    readonly agentId: string;
    readonly counterpartyId: string;
    readonly action: {
      readonly packageId: string;
      readonly module?: string;
      readonly functionName: string;
      readonly templateId?: string;
      readonly templateVersion?: string;
    };
    readonly policyDecision: AgentPolicyDecision;
  };
  readonly metadata?: Record<string, unknown>;
}

export type A2ATaskErrorCode =
  | "A2A_VERSION_NOT_SUPPORTED"
  | "A2A_MESSAGE_INVALID"
  | "A2A_MANIFEST_REQUIRED"
  | "A2A_POLICY_REQUIRED"
  | "A2A_MANIFEST_INVALID"
  | "A2A_TASK_NOT_FOUND"
  | "A2A_TASK_TERMINAL"
  | "A2A_CONTEXT_MISMATCH";

export class A2ATaskError extends Error {
  readonly code: A2ATaskErrorCode;
  readonly status: 400 | 404 | 409;

  constructor(code: A2ATaskErrorCode, message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "A2ATaskError";
    this.code = code;
    this.status = status;
  }
}

export interface A2AProcessMessageContext {
  readonly task: A2ATask;
  readonly message: A2AMessage;
  readonly manifest?: AgentTransactionManifest;
  readonly policyDecision?: AgentPolicyDecision;
}

export interface A2AProcessMessageResult {
  readonly state: A2ATaskState;
  readonly message?: A2AMessage;
  readonly artifacts?: readonly A2AArtifact[];
  readonly metadata?: Record<string, unknown>;
}

export interface SendA2AMessageOptions {
  readonly store: LocalA2ATaskStore;
  readonly protocolVersion?: string;
  readonly message: A2AMessage;
  readonly manifest?: unknown;
  readonly policy?: AgentActionPolicy;
  readonly now?: Date;
  readonly contextId?: string;
  readonly processMessage?: (
    context: A2AProcessMessageContext,
  ) => Promise<A2AProcessMessageResult> | A2AProcessMessageResult;
}

export interface SendA2AMessageResult {
  readonly task: A2ATask;
  readonly policyDecision?: AgentPolicyDecision;
}

export interface GetA2ATaskOptions {
  readonly store: LocalA2ATaskStore;
  readonly id: string;
  readonly includeArtifacts?: boolean;
  readonly historyLength?: number;
}

export interface GetA2ATaskResult {
  readonly task: A2ATask;
}

export interface ListA2ATasksOptions {
  readonly store: LocalA2ATaskStore;
  readonly contextId?: string;
  readonly state?: A2ATaskState;
  readonly includeArtifacts?: boolean;
  readonly historyLength?: number;
  readonly pageSize?: number;
}

export interface ListA2ATasksResult {
  readonly tasks: readonly A2ATask[];
}

export interface CancelA2ATaskOptions {
  readonly store: LocalA2ATaskStore;
  readonly id: string;
  readonly now?: Date;
  readonly includeArtifacts?: boolean;
}

export class LocalA2ATaskStore {
  readonly #tasks = new Map<string, A2ATask>();

  put(task: A2ATask): A2ATask {
    const safeTask = redactA2ATask(task);
    this.#tasks.set(safeTask.id, clone(safeTask));
    return clone(safeTask);
  }

  get(id: string): A2ATask | undefined {
    const task = this.#tasks.get(id);
    return task ? clone(task) : undefined;
  }

  list(): readonly A2ATask[] {
    return [...this.#tasks.values()].map((task) => clone(task));
  }
}

export async function sendA2AMessage(options: SendA2AMessageOptions): Promise<SendA2AMessageResult> {
  assertSupportedVersion(options.protocolVersion);
  assertValidMessage(options.message, "$.message");
  if (options.message.role !== "ROLE_USER") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A client messages must use ROLE_USER.");
  }

  const now = options.now ?? new Date();
  const message = redactA2AMessage(options.message);
  if (message.taskId) {
    return continueTask(options, message, now);
  }
  return createTask(options, message, now);
}

export function getA2ATask(options: GetA2ATaskOptions): GetA2ATaskResult {
  const task = options.store.get(options.id);
  if (!task) throw new A2ATaskError("A2A_TASK_NOT_FOUND", "A2A task was not found.", 404);
  return { task: taskView(task, options) };
}

export function listA2ATasks(options: ListA2ATasksOptions): ListA2ATasksResult {
  const tasks = options.store.list()
    .filter((task) => options.contextId === undefined || task.contextId === options.contextId)
    .filter((task) => options.state === undefined || task.status.state === options.state)
    .sort((left, right) => Date.parse(right.status.timestamp) - Date.parse(left.status.timestamp))
    .slice(0, options.pageSize ?? Number.POSITIVE_INFINITY)
    .map((task) => taskView(task, options));
  return { tasks };
}

export function cancelA2ATask(options: CancelA2ATaskOptions): GetA2ATaskResult {
  const task = options.store.get(options.id);
  if (!task) throw new A2ATaskError("A2A_TASK_NOT_FOUND", "A2A task was not found.", 404);
  if (isTerminalTaskState(task.status.state)) {
    throw new A2ATaskError("A2A_TASK_TERMINAL", "Terminal A2A tasks cannot be canceled.", 409);
  }
  const canceled: A2ATask = {
    ...task,
    status: {
      state: "TASK_STATE_CANCELED",
      timestamp: timestamp(options.now),
    },
    artifacts: undefined,
  };
  options.store.put(canceled);
  return { task: taskView(canceled, options) };
}

export function redactA2ATaskForLog(task: A2ATask): unknown {
  return redactDeep(task);
}

function createTask(
  options: SendA2AMessageOptions,
  message: A2AMessage,
  now: Date,
): Promise<SendA2AMessageResult> | SendA2AMessageResult {
  if (options.manifest === undefined) {
    throw new A2ATaskError("A2A_MANIFEST_REQUIRED", "New A2A tasks require an AgentRail manifest.");
  }
  if (!options.policy) {
    throw new A2ATaskError("A2A_POLICY_REQUIRED", "New A2A tasks require an AgentRail policy.");
  }

  const manifestResult = validateAgentTransactionManifest(options.manifest, { now });
  if (!manifestResult.ok) {
    throw new A2ATaskError("A2A_MANIFEST_INVALID", "A2A task manifest failed validation.");
  }
  const manifest = manifestResult.manifest;
  const policyDecision = evaluateAgentActionPolicy(options.policy, manifest, { now });
  const baseTask: A2ATask = {
    id: randomId("task"),
    contextId: message.contextId ?? options.contextId ?? randomId("ctx"),
    status: {
      state: policyDecision.allowed ? "TASK_STATE_SUBMITTED" : "TASK_STATE_REJECTED",
      timestamp: timestamp(now),
      ...(!policyDecision.allowed ? { message: rejectionMessage(policyDecision, now) } : {}),
    },
    history: policyDecision.allowed ? [message] : [message, rejectionMessage(policyDecision, now)],
    agenticAgentRail: {
      manifestId: manifest.idempotencyKey,
      agentId: manifest.agent.id,
      counterpartyId: manifest.counterparty.id,
      action: {
        packageId: manifest.action.packageId,
        ...(manifest.action.module ? { module: manifest.action.module } : {}),
        functionName: manifest.action.functionName,
        ...(manifest.action.templateId ? { templateId: manifest.action.templateId } : {}),
        ...(manifest.action.templateVersion ? { templateVersion: manifest.action.templateVersion } : {}),
      },
      policyDecision,
    },
  };

  if (!policyDecision.allowed) {
    return { task: options.store.put(baseTask), policyDecision };
  }

  return processAndStoreTask(options, baseTask, message, now, manifest, policyDecision);
}

async function continueTask(
  options: SendA2AMessageOptions,
  message: A2AMessage,
  now: Date,
): Promise<SendA2AMessageResult> {
  const task = options.store.get(message.taskId ?? "");
  if (!task) throw new A2ATaskError("A2A_TASK_NOT_FOUND", "A2A task was not found.", 404);
  if (isTerminalTaskState(task.status.state)) {
    throw new A2ATaskError("A2A_TASK_TERMINAL", "Terminal A2A tasks cannot accept follow-up messages.", 409);
  }
  if (message.contextId !== undefined && message.contextId !== task.contextId) {
    throw new A2ATaskError("A2A_CONTEXT_MISMATCH", "Follow-up A2A message context does not match the task.", 409);
  }

  const nextTask: A2ATask = {
    ...task,
    history: [...task.history, message],
    status: {
      state: task.status.state,
      timestamp: timestamp(now),
      ...(task.status.message ? { message: task.status.message } : {}),
    },
  };
  return processAndStoreTask(options, nextTask, message, now, undefined, task.agenticAgentRail?.policyDecision);
}

async function processAndStoreTask(
  options: SendA2AMessageOptions,
  task: A2ATask,
  message: A2AMessage,
  now: Date,
  manifest?: AgentTransactionManifest,
  policyDecision?: AgentPolicyDecision,
): Promise<SendA2AMessageResult> {
  const outcome = options.processMessage
    ? await options.processMessage({ task, message, manifest, policyDecision })
    : {
        state: "TASK_STATE_COMPLETED" as const,
        artifacts: [{
          artifactId: randomId("artifact"),
          parts: [{ text: "A2A task accepted by local AgentRail runtime." }],
        }],
      };
  assertValidTaskState(outcome.state);
  if (outcome.message) assertValidMessage(outcome.message, "$.processMessage.message");
  for (const [index, artifact] of (outcome.artifacts ?? []).entries()) {
    assertValidArtifact(artifact, `$.processMessage.artifacts[${index}]`);
  }
  if (isArtifactForbiddenState(outcome.state) && (outcome.artifacts?.length ?? 0) > 0) {
    throw new A2ATaskError(
      "A2A_MESSAGE_INVALID",
      "Terminal failed, rejected, and canceled tasks cannot attach artifacts.",
    );
  }

  const statusMessage = outcome.message ? redactA2AMessage(outcome.message) : undefined;
  const nextTask: A2ATask = {
    ...task,
    status: {
      state: outcome.state,
      timestamp: timestamp(now),
      ...(statusMessage ? { message: statusMessage } : {}),
    },
    history: statusMessage ? [...task.history, statusMessage] : task.history,
    ...(outcome.artifacts ? { artifacts: outcome.artifacts.map(redactA2AArtifact) } : {}),
    ...(outcome.metadata ? { metadata: redactRecord(outcome.metadata) } : {}),
  };
  return { task: options.store.put(nextTask), policyDecision };
}

function rejectionMessage(policyDecision: Exclude<AgentPolicyDecision, { allowed: true }>, now: Date): A2AMessage {
  return {
    messageId: `policy-${timestamp(now)}`,
    role: "ROLE_AGENT",
    parts: [{ text: `AgentRail policy denied the A2A task: ${policyDecision.reasonCode}` }],
    metadata: {
      reasonCode: policyDecision.reasonCode,
    },
  };
}

function assertSupportedVersion(version: string | undefined = A2A_TASK_PROTOCOL_VERSION): void {
  if (version !== A2A_TASK_PROTOCOL_VERSION) {
    throw new A2ATaskError("A2A_VERSION_NOT_SUPPORTED", "A2A protocol version is unsupported.");
  }
}

function assertValidTaskState(state: string): asserts state is A2ATaskState {
  if (![
    "TASK_STATE_SUBMITTED",
    "TASK_STATE_WORKING",
    "TASK_STATE_INPUT_REQUIRED",
    "TASK_STATE_COMPLETED",
    "TASK_STATE_CANCELED",
    "TASK_STATE_FAILED",
    "TASK_STATE_REJECTED",
  ].includes(state)) {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A task state is invalid.");
  }
}

function assertValidMessage(message: A2AMessage, path: string): void {
  if (!message || typeof message !== "object") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A message must be an object.");
  }
  if (typeof message.messageId !== "string" || message.messageId.trim() === "") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A messageId is required.");
  }
  if (message.role !== "ROLE_USER" && message.role !== "ROLE_AGENT") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", "A2A message role is invalid.");
  }
  requireOptionalNonEmptyString(message.taskId, `${path}.taskId`);
  requireOptionalNonEmptyString(message.contextId, `${path}.contextId`);
  if (!Array.isArray(message.parts) || message.parts.length === 0) {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path}.parts must contain at least one part.`);
  }
  message.parts.forEach((part, index) => assertValidPart(part, `${path}.parts[${index}]`));
}

function assertValidArtifact(artifact: A2AArtifact, path: string): void {
  if (typeof artifact.artifactId !== "string" || artifact.artifactId.trim() === "") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path}.artifactId is required.`);
  }
  if (!Array.isArray(artifact.parts) || artifact.parts.length === 0) {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path}.parts must contain at least one part.`);
  }
  artifact.parts.forEach((part, index) => assertValidPart(part, `${path}.parts[${index}]`));
}

function assertValidPart(part: A2APart, path: string): void {
  if (!part || typeof part !== "object" || Array.isArray(part)) {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path} must be an object.`);
  }
  const variants = [
    typeof part.text === "string" && part.text.trim() !== "",
    isRecord(part.data),
    isRecord(part.file),
  ].filter(Boolean);
  if (variants.length !== 1) {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path} must contain exactly one text, data, or file part.`);
  }
}

function taskView(
  task: A2ATask,
  options: { readonly includeArtifacts?: boolean; readonly historyLength?: number },
): A2ATask {
  const history = typeof options.historyLength === "number"
    ? task.history.slice(-Math.max(0, options.historyLength))
    : task.history;
  return clone({
    ...task,
    history,
    ...(options.includeArtifacts ? { artifacts: task.artifacts } : { artifacts: undefined }),
  });
}

function redactA2AMessage(message: A2AMessage): A2AMessage {
  return {
    ...message,
    parts: message.parts.map(redactA2APart),
    ...(message.metadata ? { metadata: redactRecord(message.metadata) } : {}),
  };
}

function redactA2ATask(task: A2ATask): A2ATask {
  return redactDeep(task) as A2ATask;
}

function redactA2AArtifact(artifact: A2AArtifact): A2AArtifact {
  return {
    ...artifact,
    parts: artifact.parts.map(redactA2APart),
    ...(artifact.metadata ? { metadata: redactRecord(artifact.metadata) } : {}),
  };
}

function redactA2APart(part: A2APart): A2APart {
  return redactDeep(part) as A2APart;
}

function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return redactDeep(value) as Record<string, unknown>;
}

function redactDeep(value: unknown, key = ""): unknown {
  if (isSecretField(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactDeep(item));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactDeep(child, childKey)]));
  }
  if (typeof value === "string") return redactString(value);
  return value;
}

function redactString(value: string): string {
  if (/private\s+prompt\s*:/i.test(value)) return "[REDACTED]";
  if (/(mnemonic|private key|raw keypair|payment credential)/i.test(value)) return "[REDACTED]";
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9._-]+/gi, "[REDACTED]")
    .replace(/signer_ref_[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/([?&](?:token|signature|X-Amz-Signature)=)[^&#\s]+/gi, "$1[REDACTED]");
}

function isTerminalTaskState(state: A2ATaskState): boolean {
  return [
    "TASK_STATE_COMPLETED",
    "TASK_STATE_CANCELED",
    "TASK_STATE_FAILED",
    "TASK_STATE_REJECTED",
  ].includes(state);
}

function isArtifactForbiddenState(state: A2ATaskState): boolean {
  return ["TASK_STATE_CANCELED", "TASK_STATE_FAILED", "TASK_STATE_REJECTED"].includes(state);
}

function requireOptionalNonEmptyString(value: string | undefined, path: string): void {
  if (value !== undefined && value.trim() === "") {
    throw new A2ATaskError("A2A_MESSAGE_INVALID", `${path} must be non-empty when present.`);
  }
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function timestamp(now: Date | undefined): string {
  return (now ?? new Date()).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSecretField(key: string): boolean {
  return /^(seed|mnemonic|privateKey|private_key|rawKeypair|raw_keypair|rawTransactionBytes|raw_transaction_bytes|userSignature|user_signature|sponsorKey|sponsor_key|appApiKey|app_api_key|bearerToken|bearer_token|paymentCredential|payment_credential|signerSecret|signer_secret|signerRef|signer_ref|walletId|wallet_id|privatePrompt|private_prompt|prompt|paymentPayload|payment_payload|bytes)$/i.test(key);
}
