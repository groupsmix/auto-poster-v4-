// ============================================================
// Unit Tests — StructuredLogger
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StructuredLogger } from "@nexus/shared";

describe("StructuredLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info messages as JSON to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-router");
    logger.info("Request received", { path: "/api/health" });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.worker).toBe("nexus-router");
    expect(parsed.message).toBe("Request received");
    expect(parsed.path).toBe("/api/health");
    expect(parsed.timestamp).toBeDefined();
  });

  it("logs error messages to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-ai");
    logger.error("Gateway timeout", { model: "deepseek" });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.model).toBe("deepseek");
  });

  it("logs warn messages to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-workflow");
    logger.warn("Step retrying");

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
  });

  it("includes requestId when set via withRequestId", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-router").withRequestId("abc-123");
    logger.info("Handling request");

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.requestId).toBe("abc-123");
  });

  it("does not include requestId when not set", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-storage");
    logger.info("Query executed");

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.requestId).toBeUndefined();
  });

  it("respects minLevel — skips debug when minLevel is info", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-router", { minLevel: "info" });

    logger.debug("Should be skipped");
    logger.info("Should appear");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
  });

  it("allows debug when minLevel is debug", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = new StructuredLogger("nexus-router", { minLevel: "debug" });
    logger.debug("Debug message");

    expect(spy).toHaveBeenCalledOnce();
  });
});
