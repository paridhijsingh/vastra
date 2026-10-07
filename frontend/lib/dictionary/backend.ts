import { getApiUrl } from "@/lib/config";
import type { BackendResult } from "@/lib/auth/backend";
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

function authHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function backendListDictionary(
  accessToken: string,
  filters: DictionaryFilters,
): Promise<BackendResult<DictionaryEntry[]>> {
  const url = new URL(`${getApiUrl()}/dictionary`);
  const q = filters.q.trim();
  if (q) url.searchParams.set("q", q);
  if (filters.style) url.searchParams.set("style", filters.style);
  if (filters.kind) url.searchParams.set("kind", filters.kind);

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
