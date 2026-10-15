import { getApiUrl } from "@/lib/config";
import type { EventCreateBody, EventFieldErrors, EventPatchBody } from "@/lib/events/form";

export type EventFailureKind = "validation" | "unauthorized" | "not_found" | "unavailable" | "unknown";

export type EventBackendResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; kind: EventFailureKind; message: string; fields: EventFieldErrors; status: number };

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
  kind: EventFailureKind,
  message: string,
  status: number,
  fields: EventFieldErrors = {},
): EventBackendResult<T> {
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

function validationFields(detail: unknown): EventFieldErrors {
  if (!Array.isArray(detail)) return {};
  const fields: EventFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item)) continue;
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) continue;
    const field = loc.filter((part) => part !== "body").map(String)[0];
    if (
      field !== "name" &&
      field !== "event_date" &&
      field !== "occasion" &&
      field !== "notes" &&
      field !== "comfort_needs" &&
      field !== "look_id"
    ) {
      continue;
    }
    if (fields[field]) continue;
    fields[field] =
      field === "name"
        ? "Name is required."
        : field === "event_date"
          ? "Event date must be a calendar date."
          : field === "occasion"
            ? "Occasion must be at most 200 characters."
            : field === "notes"
              ? "Notes must be at most 1000 characters."
              : field === "look_id"
                ? "Choose a saved look or none."
                : "Check the comfort needs and try again.";
  }
  return fields;
}

export async function backendListEvents(accessToken: string): Promise<EventBackendResult<unknown>> {
  return requestJson(accessToken, "/events", { method: "GET" });
}

export async function backendGetEvent(accessToken: string, eventId: string): Promise<EventBackendResult<unknown>> {
  return requestJson(accessToken, `/events/${encodeURIComponent(eventId)}`, { method: "GET" });
}

export async function backendCreateEvent(
  accessToken: string,
  body: EventCreateBody,
): Promise<EventBackendResult<unknown>> {
  return requestJson(accessToken, "/events", { method: "POST", body });
}

export async function backendUpdateEvent(
  accessToken: string,
  eventId: string,
  body: EventPatchBody,
): Promise<EventBackendResult<unknown>> {
  return requestJson(accessToken, `/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body });
}

export async function backendDeleteEvent(accessToken: string, eventId: string): Promise<EventBackendResult<null>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: authHeaders(accessToken),
    });
  } catch {
    return failure("unavailable", "Saved events are temporarily unavailable. Please try again later.", 503);
  }
  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 404) {
    return failure("not_found", "That saved event could not be found.", 404);
  }
  if (response.status === 204 || response.ok) {
    return { ok: true, data: null, status: response.status };
  }
  return failure("unknown", "The event could not be deleted. Please try again.", response.status);
}

async function requestJson(
  accessToken: string,
  path: string,
  init: { method: string; body?: EventCreateBody | EventPatchBody },
): Promise<EventBackendResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: init.method,
      cache: "no-store",
      headers: authHeaders(accessToken, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return failure("unavailable", "Saved events are temporarily unavailable. Please try again later.", 503);
  }
  if (response.status === 401) {
    return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (response.status === 404) {
    const message =
      init.method === "POST" ? "That saved look could not be found." : "That saved event could not be found.";
    return failure("not_found", message, 404);
  }
  if (response.status === 422) {
    const detail = await readDetail(response);
    return failure("validation", "Check the highlighted fields and try again.", 422, validationFields(detail));
  }
  if (!response.ok) {
    return failure("unknown", "Saved events are temporarily unavailable. Please try again later.", response.status);
  }
  try {
    return { ok: true, data: await response.json(), status: response.status };
  } catch {
    return failure("unknown", "Saved events are temporarily unavailable. Please try again later.", 502);
  }
}

export function proxyStatus(result: Extract<EventBackendResult<unknown>, { ok: false }>): number {
  if (result.kind === "validation") return 422;
  if (result.kind === "not_found") return 404;
  if (result.kind === "unauthorized") return 401;
  if (result.kind === "unavailable") return 503;
  return 502;
}
