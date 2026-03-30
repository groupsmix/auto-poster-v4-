import { toast } from "sonner";

/**
 * Centralised error handler for API operations.
 *
 * Shows a toast with a user-friendly message and logs the raw error
 * to the console for debugging.
 *
 * @param error   — the caught error value
 * @param message — fallback toast message (shown when `error` isn't an Error)
 */
export function handleApiError(error: unknown, message = "Something went wrong"): void {
  const text = error instanceof Error ? error.message : message;
  toast.error(text);

  // Keep the raw error visible in DevTools for debugging
  console.error("[NEXUS API Error]", error);
}
