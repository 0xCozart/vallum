export class VallumError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "VallumError";
  }
}

export class VallumPolicyError extends VallumError {
  constructor(message: string, readonly reasonCode?: string, status?: number, body?: unknown) {
    super(message, status, body);
    this.name = "VallumPolicyError";
  }
}

export class VallumAuthError extends VallumError {
  constructor(message: string, status?: number, body?: unknown) {
    super(message, status, body);
    this.name = "VallumAuthError";
  }
}
