import { getApiUrl, isProxyTimeoutError, MODEL_PROXY_TIMEOUT_MS } from "@/lib/config";
import {
  fieldErrorsFromApiDetail,
  NO_AVAILABLE_ITEMS_MESSAGE,
  type EmergencyFieldErrors,
  type EmergencyFitBody,
  type EmergencyOutfitView,
  outfitFromApi,
} from "@/lib/emergency/form";

export type EmergencyFailureKind =
  | "validation"
  | "unauthorized"
  | "conflict"
  | "timeout"
  | "unavailable"
  | "failed"
  | "unknown";

export type EmergencyBackendResult =
  | { ok: true; data: EmergencyOutfitView; status: number }
  | {
      ok: false;
      kind: EmergencyFailureKind;
      message: string;
      fields: EmergencyFieldErrors;
      status: number;
    };

function authHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Authorization: `Bearer ${accessToken}`,
  };
}

function failure(
  kind: EmergencyFailureKind,
  message: string,
  status: number,
  fields: EmergencyFieldErrors = {},
): EmergencyBackendResult {
  return { ok: false, kind, message, fields, status };
}

export async function backendCreateEmergencyOutfit(
  accessToken: string,
  body: EmergencyFitBody,
): Promise<EmergencyBackendResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/outfits/emergency`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(MODEL_PROXY_TIMEOUT_MS),
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isProxyTimeoutError(error)) {
      return failure("timeout", "The outfit request timed out. Please try again.", 504);
    }
    return failure(
      "unavailable",
      "Model unavailable — try again in a minute",
      503,
    );
  }

  if (response.status === 401) {
    return failure(
      "unauthorized",
      "Your session has expired. Please sign in again.",
      401,
    );
  }

  if (response.status === 409) {
    return failure("conflict", NO_AVAILABLE_ITEMS_MESSAGE, 409);
  }

  if (response.status === 422) {
    const detail = await readDetail(response);
    const fields = fieldErrorsFromApiDetail(detail);
    return failure(
      "validation",
      Object.keys(fields).length > 0
        ? "Check the highlighted fields and try again."
        : "Check the occasion, vibe, and comfort needs and try again.",
      422,
      fields,
    );
  }

  if (response.status === 504) {
    return failure("timeout", "The outfit request timed out. Please try again.", 504);
  }

  if (response.status === 503) {
    return failure(
      "unavailable",
      "Model unavailable — try again in a minute",
      503,
    );
  }

  if (response.status === 502) {
    return failure(
      "failed",
      "The outfit suggestion could not be used. Please try again.",
      502,
    );
  }

  if (!response.ok) {
    return failure(
      "unknown",
      "The outfit suggestion could not be used. Please try again.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure("failed", "The outfit suggestion could not be used. Please try again.", 502);
  }
  const outfit = outfitFromApi(payload);
  if (!outfit) {
    return failure("failed", "The outfit suggestion could not be used. Please try again.", 502);
  }
  return { ok: true, data: outfit, status: response.status };
}

async function readDetail(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      return (body as { detail: unknown }).detail;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function proxyStatus(result: Extract<EmergencyBackendResult, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "conflict") return 409;
  if (result.kind === "timeout") return 504;
  if (result.kind === "unavailable") return 503;
  if (result.kind === "failed") return 502;
  if (result.kind === "unauthorized") return 401;
  return result.status === 503 ? 503 : 502;
}
