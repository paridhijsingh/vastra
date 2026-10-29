import { getApiUrl, isProxyTimeoutError, MODEL_PROXY_TIMEOUT_MS } from "@/lib/config";
import {
  ITEMS_CHANGED_MESSAGE,
  fieldErrorsFromApiDetail,
  rescueOutfitFromApi,
  type RescueBody,
  type RescueFieldErrors,
} from "@/lib/rescue/form";

export type RescueFailureKind =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "timeout"
  | "unavailable"
  | "failed"
  | "unknown";

export type RescueBackendResult =
  | { ok: true; data: unknown; status: number }
  | {
      ok: false;
      kind: RescueFailureKind;
      message: string;
      fields: RescueFieldErrors;
      status: number;
    };

function failure(
  kind: RescueFailureKind,
  message: string,
  status: number,
  fields: RescueFieldErrors = {},
): RescueBackendResult {
  return { ok: false, kind, message, fields, status };
}

export async function backendRescueOutfit(
  accessToken: string,
  body: RescueBody,
): Promise<RescueBackendResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/outfits/rescue`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(MODEL_PROXY_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${accessToken}`,
      },
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
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 404) {
    return failure("not_found", ITEMS_CHANGED_MESSAGE, 404);
  }
  if (response.status === 409) {
    return failure("conflict", ITEMS_CHANGED_MESSAGE, 409);
  }
  if (response.status === 422) {
    const detail = await readDetail(response);
    const fields = fieldErrorsFromApiDetail(detail);
    return failure(
      "validation",
      "Check the highlighted fields and try again.",
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
  if (!response.ok) {
    return failure(
      "failed",
      "The outfit suggestion could not be used. Please try again.",
      response.status === 502 ? 502 : response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure("failed", "The outfit suggestion could not be used. Please try again.", 502);
  }
  const outfit = rescueOutfitFromApi(payload);
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

export function proxyStatus(result: Extract<RescueBackendResult, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "not_found") return 404;
  if (result.kind === "conflict") return 409;
  if (result.kind === "timeout") return 504;
  if (result.kind === "unavailable") return 503;
  if (result.kind === "failed") return 502;
  if (result.kind === "unauthorized") return 401;
  return 502;
}
