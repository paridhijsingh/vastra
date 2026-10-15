import { getApiUrl } from "@/lib/config";
import {
  DELETED_ITEM_SAVE_ERROR,
  type LookCreateBody,
  type LookFieldErrors,
  type LookPatchBody,
} from "@/lib/looks/form";

export type LookFailureKind =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "unavailable"
  | "unknown";

export type LookBackendResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; kind: LookFailureKind; message: string; fields: LookFieldErrors; status: number };

function authHeaders(accessToken: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function failure<T>(
  kind: LookFailureKind,
  message: string,
  status: number,
  fields: LookFieldErrors = {},
): LookBackendResult<T> {
  return { ok: false, kind, message, fields, status };
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

function validationFields(detail: unknown): LookFieldErrors {
  if (!Array.isArray(detail)) return {};
  const fields: LookFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item)) continue;
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) continue;
    const field = loc.filter((part) => part !== "body").map(String)[0];
    if (field !== "name" && field !== "occasion" && field !== "notes" && field !== "item_ids") continue;
    if (fields[field]) continue;
    fields[field] =
      field === "name"
        ? "Name is required."
        : field === "occasion"
          ? "Occasion must be at most 200 characters."
          : field === "notes"
            ? "Notes must be at most 1000 characters."
            : "Check the outfit items and try again.";
  }
  return fields;
}

export async function backendListLooks(accessToken: string): Promise<LookBackendResult<unknown>> {
  return requestJson(accessToken, "/looks", { method: "GET" });
}

export async function backendGetLook(accessToken: string, lookId: string): Promise<LookBackendResult<unknown>> {
  return requestJson(accessToken, `/looks/${encodeURIComponent(lookId)}`, { method: "GET" });
}

export async function backendCreateLook(
  accessToken: string,
  body: LookCreateBody,
): Promise<LookBackendResult<unknown>> {
  return requestJson(accessToken, "/looks", { method: "POST", body });
}

export async function backendUpdateLook(
  accessToken: string,
  lookId: string,
  body: LookPatchBody,
): Promise<LookBackendResult<unknown>> {
  return requestJson(accessToken, `/looks/${encodeURIComponent(lookId)}`, { method: "PATCH", body });
}

export async function backendDeleteLook(accessToken: string, lookId: string): Promise<LookBackendResult<null>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/looks/${encodeURIComponent(lookId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: authHeaders(accessToken),
    });
  } catch {
    return failure("unavailable", "Saved looks are temporarily unavailable. Please try again later.", 503);
  }
  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 404) {
    return failure("not_found", "That saved look could not be found.", 404);
  }
  if (response.status === 204 || response.ok) {
    return { ok: true, data: null, status: response.status };
  }
  return failure("unknown", "The look could not be deleted. Please try again.", response.status);
}

async function requestJson(
  accessToken: string,
  path: string,
  init: { method: string; body?: LookCreateBody | LookPatchBody },
): Promise<LookBackendResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: init.method,
      cache: "no-store",
      headers: authHeaders(accessToken, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return failure("unavailable", "Saved looks are temporarily unavailable. Please try again later.", 503);
  }
  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 404) {
    const message = init.method === "POST" ? DELETED_ITEM_SAVE_ERROR : "That saved look could not be found.";
    return failure("not_found", message, 404);
  }
  if (response.status === 422) {
    const detail = await readDetail(response);
    return failure("validation", "Check the highlighted fields and try again.", 422, validationFields(detail));
  }
  if (!response.ok) {
    return failure("unknown", "Saved looks are temporarily unavailable. Please try again later.", response.status);
  }
  try {
    return { ok: true, data: await response.json(), status: response.status };
  } catch {
    return failure("unknown", "Saved looks are temporarily unavailable. Please try again later.", 502);
  }
}

export function proxyStatus(result: Extract<LookBackendResult<unknown>, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "not_found") return 404;
  if (result.kind === "unauthorized") return 401;
  if (result.kind === "unavailable") return 503;
  return 502;
}
