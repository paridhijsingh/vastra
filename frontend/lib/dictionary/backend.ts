import { getApiUrl } from "@/lib/config";
import type { BackendResult } from "@/lib/auth/backend";
import { fieldErrorsFromApiDetail, type DictionaryCreatePayload, type DictionaryPatchPayload } from "@/lib/dictionary/form";
import {
  parseDictionaryEntry,
  parseDictionaryList,
  type DictionaryEntry,
  type DictionaryFilters,
} from "@/lib/dictionary/types";

function unavailable<T>(): BackendResult<T> {
  return {
    ok: false,
    kind: "unavailable",
    message: "The dictionary service is unavailable. Please try again later.",
    status: 503,
  };
}

function authHeaders(accessToken: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
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

function validationMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) return null;
        const loc =
          "loc" in item && Array.isArray((item as { loc: unknown }).loc)
            ? (item as { loc: unknown[] }).loc.filter((part) => part !== "body").join(".")
            : "";
        const msg = String((item as { msg: unknown }).msg);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join(" ");
  }
  return "Check the dictionary fields and try again.";
}

export type DictionaryMutationFailure = {
  ok: false;
  kind: "validation" | "unauthorized" | "unavailable" | "not_found" | "forbidden" | "unknown";
  message: string;
  status: number;
  fields: ReturnType<typeof fieldErrorsFromApiDetail>;
};

export async function backendListDictionary(
  accessToken: string,
  filters: DictionaryFilters,
): Promise<BackendResult<DictionaryEntry[]>> {
  const url = new URL(`${getApiUrl()}/dictionary`);
  const q = filters.q.trim();
  const tag = filters.tag.trim();
  if (q) url.searchParams.set("q", q);
  if (filters.style) url.searchParams.set("style", filters.style);
  if (filters.kind) url.searchParams.set("kind", filters.kind);
  if (tag) url.searchParams.set("tag", tag);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: authHeaders(accessToken),
    });
  } catch {
    return unavailable();
  }

  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "Your session has expired. Please sign in again.",
      status: 401,
    };
  }
  if (!response.ok) {
    const unavailableStatus = response.status === 503;
    return {
      ok: false,
      kind: response.status === 422 ? "validation" : unavailableStatus ? "unavailable" : "unknown",
      message: unavailableStatus
        ? "The dictionary service is unavailable. Please try again later."
        : "Could not load the dictionary. Please try again.",
      status: response.status,
    };
  }

  const data = parseDictionaryList(await response.json());
  if (!data) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not load the dictionary. Please try again.",
      status: 502,
    };
  }
  return { ok: true, data, status: response.status };
}

export async function backendGetDictionaryEntry(
  accessToken: string,
  entryId: string,
): Promise<BackendResult<DictionaryEntry>> {
  let response: Response;
  try {
    response = await fetch(
      `${getApiUrl()}/dictionary/${encodeURIComponent(entryId)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: authHeaders(accessToken),
      },
    );
  } catch {
    return unavailable();
  }

  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "Your session has expired. Please sign in again.",
      status: 401,
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      kind: "not_found",
      message: "That dictionary entry does not exist.",
      status: 404,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not load that dictionary entry. Please try again.",
      status: response.status,
    };
  }

  const data = parseDictionaryEntry(await response.json());
  if (!data) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not load that dictionary entry. Please try again.",
      status: 502,
    };
  }
  return { ok: true, data, status: response.status };
}

function mutationUnavailable(): DictionaryMutationFailure {
  return {
    ok: false,
    kind: "unavailable",
    message: "The dictionary service is unavailable. Please try again later.",
    status: 503,
    fields: {},
  };
}

function mutationFailure(response: Response, detail: unknown, fallback: string): DictionaryMutationFailure {
  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "Your session has expired. Please sign in again.",
      status: 401,
      fields: {},
    };
  }
  if (response.status === 403) {
    return {
      ok: false,
      kind: "forbidden",
      message:
        typeof detail === "string" && detail.trim()
          ? detail
          : "Shared dictionary entries are read-only.",
      status: 403,
      fields: {},
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      kind: "not_found",
      message: "That dictionary entry does not exist.",
      status: 404,
      fields: {},
    };
  }
  if (response.status === 422) {
    return {
      ok: false,
      kind: "validation",
      message: validationMessage(detail),
      status: 422,
      fields: fieldErrorsFromApiDetail(detail),
    };
  }
  return {
    ok: false,
    kind: response.status === 503 ? "unavailable" : "unknown",
    message:
      response.status === 503
        ? "The dictionary service is unavailable. Please try again later."
        : fallback,
    status: response.status,
    fields: {},
  };
}

export async function backendCreateDictionaryEntry(
  accessToken: string,
  payload: DictionaryCreatePayload,
): Promise<{ ok: true; data: DictionaryEntry; status: number } | DictionaryMutationFailure> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/dictionary`, {
      method: "POST",
      cache: "no-store",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(payload),
    });
  } catch {
    return mutationUnavailable();
  }
  if (!response.ok) {
    return mutationFailure(response, await readDetail(response), "Could not add the term. Please try again.");
  }
  const data = parseDictionaryEntry(await response.json());
  if (!data) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not add the term. Please try again.",
      status: 502,
      fields: {},
    };
  }
  return { ok: true, data, status: response.status };
}

export async function backendPatchDictionaryEntry(
  accessToken: string,
  entryId: string,
  payload: DictionaryPatchPayload,
): Promise<{ ok: true; data: DictionaryEntry; status: number } | DictionaryMutationFailure> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/dictionary/${encodeURIComponent(entryId)}`, {
      method: "PATCH",
      cache: "no-store",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(payload),
    });
  } catch {
    return mutationUnavailable();
  }
  if (!response.ok) {
    return mutationFailure(
      response,
      await readDetail(response),
      "Could not update the term. Please try again.",
    );
  }
  const data = parseDictionaryEntry(await response.json());
  if (!data) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not update the term. Please try again.",
      status: 502,
      fields: {},
    };
  }
  return { ok: true, data, status: response.status };
}

export async function backendDeleteDictionaryEntry(
  accessToken: string,
  entryId: string,
): Promise<{ ok: true; data: null; status: number } | DictionaryMutationFailure> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/dictionary/${encodeURIComponent(entryId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: authHeaders(accessToken),
    });
  } catch {
    return mutationUnavailable();
  }
  if (response.status === 204 || response.ok) {
    return { ok: true, data: null, status: response.status };
  }
  return mutationFailure(
    response,
    await readDetail(response),
    "Could not delete the term. Please try again.",
  );
}
