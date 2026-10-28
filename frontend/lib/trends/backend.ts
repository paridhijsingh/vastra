import { getApiUrl, isProxyTimeoutError } from "@/lib/config";
import {
  TREND_UNAVAILABLE_MESSAGE,
  fieldErrorsFromApiDetail,
  ideaFromApi,
  type TrendFieldErrors,
  type TrendIdeaView,
  type TrendRequestBody,
} from "@/lib/trends/form";

export const TRENDS_PROXY_TIMEOUT_MS = 100_000;

export type TrendFailureKind = "validation" | "unauthorized" | "timeout" | "unavailable" | "failed";

export type TrendBackendResult =
  | { ok: true; data: TrendIdeaView; status: number }
  | {
      ok: false;
      kind: TrendFailureKind;
      message: string;
      fields: TrendFieldErrors;
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
  kind: TrendFailureKind,
  message: string,
  status: number,
  fields: TrendFieldErrors = {},
): TrendBackendResult {
  return { ok: false, kind, message, fields, status };
}

export async function backendCreateTrendIdea(
  accessToken: string,
  body: TrendRequestBody,
): Promise<TrendBackendResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/trends`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TRENDS_PROXY_TIMEOUT_MS),
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isProxyTimeoutError(error)) {
      return failure("timeout", TREND_UNAVAILABLE_MESSAGE, 504);
    }
    return failure("unavailable", TREND_UNAVAILABLE_MESSAGE, 503);
  }

  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }

  if (response.status === 422) {
    const detail = await readDetail(response);
    const fields = fieldErrorsFromApiDetail(detail);
    return failure(
      "validation",
      Object.keys(fields).length > 0
        ? "Check the highlighted fields and try again."
        : "Check the occasion, vibe, and budget and try again.",
      422,
      fields,
    );
  }

  if (!response.ok) {
    return failure("unavailable", TREND_UNAVAILABLE_MESSAGE, response.status === 504 ? 504 : 503);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure("unavailable", TREND_UNAVAILABLE_MESSAGE, 503);
  }
  const idea = ideaFromApi(payload);
  if (!idea) {
    return failure("unavailable", TREND_UNAVAILABLE_MESSAGE, 503);
  }
  return { ok: true, data: idea, status: response.status };
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

export function proxyStatus(result: Extract<TrendBackendResult, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "timeout") return 504;
  if (result.kind === "unavailable") return 503;
  if (result.kind === "unauthorized") return 401;
  return 503;
}
