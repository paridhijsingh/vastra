import { getApiUrl } from "@/lib/config";
import type { BackendResult } from "@/lib/auth/backend";
import type {
  AvailabilityStatus,
  WardrobeItemCreate,
  WardrobeItemPublic,
  WardrobeItemUpdate,
} from "@/lib/wardrobe/types";

function unavailable<T>(): BackendResult<T> {
  return {
    ok: false,
    kind: "unavailable",
    message: "The wardrobe service is unavailable. Please try again later.",
    status: 503,
  };
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
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc =
            "loc" in item && Array.isArray((item as { loc: unknown }).loc)
              ? (item as { loc: unknown[] }).loc
                  .filter((p) => p !== "body")
                  .join(".")
              : "";
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return null;
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return "Check your wardrobe fields and try again.";
}

function authHeaders(accessToken: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function backendListWardrobe(
  accessToken: string,
  availability?: AvailabilityStatus | null,
): Promise<BackendResult<WardrobeItemPublic[]>> {
  const url = new URL(`${getApiUrl()}/wardrobe`);
  if (availability) {
    url.searchParams.set("availability", availability);
  }

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
    return {
      ok: false,
      kind: response.status === 422 ? "validation" : "unknown",
      message: "Could not load your wardrobe. Please try again.",
      status: response.status,
    };
  }

  const data = (await response.json()) as WardrobeItemPublic[];
  return { ok: true, data, status: response.status };
}

export async function backendCreateWardrobeItem(
  accessToken: string,
  payload: WardrobeItemCreate,
): Promise<BackendResult<WardrobeItemPublic>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/wardrobe`, {
      method: "POST",
      cache: "no-store",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(payload),
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
    const detail = await readDetail(response);
    return {
      ok: false,
      kind: response.status === 422 ? "validation" : "unknown",
      message:
        response.status === 422
          ? validationMessage(detail)
          : "Could not add the item. Please try again.",
      status: response.status,
    };
  }

  const data = (await response.json()) as WardrobeItemPublic;
  return { ok: true, data, status: response.status };
}

export async function backendPatchWardrobeItem(
  accessToken: string,
  itemId: string,
  payload: WardrobeItemUpdate,
): Promise<BackendResult<WardrobeItemPublic>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/wardrobe/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      cache: "no-store",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(payload),
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
  if (response.status === 404) {
    return {
      ok: false,
      kind: "unknown",
      message: "That wardrobe item was not found.",
      status: 404,
    };
  }
  if (!response.ok) {
    const detail = await readDetail(response);
    return {
      ok: false,
      kind: response.status === 422 ? "validation" : "unknown",
      message:
        response.status === 422
          ? validationMessage(detail)
          : "Could not update the item. Please try again.",
      status: response.status,
    };
  }

  const data = (await response.json()) as WardrobeItemPublic;
  return { ok: true, data, status: response.status };
}

export async function backendDeleteWardrobeItem(
  accessToken: string,
  itemId: string,
): Promise<BackendResult<null>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/wardrobe/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
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
  if (response.status === 404) {
    return {
      ok: false,
      kind: "unknown",
      message: "That wardrobe item was not found.",
      status: 404,
    };
  }
  if (!response.ok && response.status !== 204) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not delete the item. Please try again.",
      status: response.status,
    };
  }

  return { ok: true, data: null, status: 204 };
}
