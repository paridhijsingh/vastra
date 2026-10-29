import { getApiUrl, isProxyTimeoutError, MODEL_PROXY_TIMEOUT_MS } from "@/lib/config";
import { replyFromApi, type StylistTurn } from "@/lib/stylist/form";

export type StylistFailureKind = "validation" | "unauthorized" | "timeout" | "unavailable" | "failed";

export type StylistBackendResult =
  | { ok: true; reply: unknown }
  | { ok: false; kind: StylistFailureKind; message: string; status: number };

const KNOWN_DETAILS = new Set([
  "Outfit suggestions are unavailable because model settings are not configured.",
  "The stylist reply could not be used. Please try again.",
  "The stylist request timed out. Please try again.",
  "The model service rate-limited the request. Try again later.",
  "Model unavailable — try again in a minute",
]);

function failure(kind: StylistFailureKind, message: string, status: number): StylistBackendResult {
  return { ok: false, kind, message, status };
}

export async function backendStylistChat(
  accessToken: string,
  message: string,
  history: readonly StylistTurn[],
): Promise<StylistBackendResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/stylist/chat`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(MODEL_PROXY_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message, history }),
    });
  } catch (error) {
    if (isProxyTimeoutError(error)) {
      return failure("timeout", "The stylist request timed out. Please try again.", 504);
    }
    return failure("unavailable", "Model unavailable — try again in a minute", 503);
  }

  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 422) {
    return failure("validation", "Check the message and try again.", 422);
  }

  const detail = await readDetail(response);
  const known = typeof detail === "string" && KNOWN_DETAILS.has(detail) ? detail : null;
  if (response.status === 504) {
    return failure("timeout", known ?? "The stylist request timed out. Please try again.", 504);
  }
  if (response.status === 503) {
    return failure("unavailable", known ?? "Model unavailable — try again in a minute", 503);
  }
  if (!response.ok) {
    return failure("failed", known ?? "The stylist reply could not be used. Please try again.", response.status === 502 ? 502 : 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure("failed", "The stylist reply could not be used. Please try again.", 502);
  }
  if (!replyFromApi(payload)) {
    return failure("failed", "The stylist reply could not be used. Please try again.", 502);
  }
  return { ok: true, reply: payload };
}

async function readDetail(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === "object" && "detail" in body) {
      return (body as { detail: unknown }).detail;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function proxyStatus(result: Extract<StylistBackendResult, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "timeout") return 504;
  if (result.kind === "unavailable") return 503;
  if (result.kind === "unauthorized") return 401;
  return 502;
}
