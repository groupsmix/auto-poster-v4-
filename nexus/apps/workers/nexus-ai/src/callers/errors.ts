// ============================================================
// Shared error class for all AI provider callers
// Status codes: 429 = rate limited, 402 = quota exceeded
// ============================================================

export class AICallerError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AICallerError";
    this.status = status;
    this.code = code;
  }
}
