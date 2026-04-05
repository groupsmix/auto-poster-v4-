// Mock for cloudflare:workers virtual module used in Vitest
// This module only exists in the Cloudflare Workers runtime.

export class WorkflowEntrypoint<TEnv = unknown, TParams = unknown> {
  protected env: TEnv;
  protected ctx: unknown;

  constructor(ctx: unknown, env: TEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  async run(_event: WorkflowEvent<TParams>, _step: WorkflowStep): Promise<unknown> {
    throw new Error("WorkflowEntrypoint.run() must be overridden");
  }
}

export interface WorkflowEvent<T = unknown> {
  payload: T;
  timestamp: Date;
  instanceId: string;
}

export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  do<T>(name: string, config: Record<string, unknown>, callback: () => Promise<T>): Promise<T>;
  sleep(name: string, duration: string | number): Promise<void>;
  sleepUntil(name: string, timestamp: Date | string): Promise<void>;
  waitForEvent<T = unknown>(name: string, options?: Record<string, unknown>): Promise<T>;
}
