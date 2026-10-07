import { getApiUrl } from "@/lib/config";
import type { BackendResult } from "@/lib/auth/backend";
import type { ProfilePayload, ProfilePublic } from "@/lib/profile/types";

function unavailable<T>(): BackendResult<T> {
  return {
    ok: false,
    kind: "unavailable",
    message: "The profile service is unavailable. Please try again later.",
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
              ? (item as { loc: unknown[] }).loc.filter((p) => p !== "body").join(".")
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
  return "Check your profile fields and try again.";
}

const noStoreInit = {
  cache: "no-store" as const,
  headers: {
    Accept: "application/json",
    "Cache-Control": "no-store",
  },
};

export async function backendGetProfile(
  accessToken: string,
): Promise<BackendResult<ProfilePublic | null>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/profile`, {
      method: "GET",
      ...noStoreInit,
      headers: {
        ...noStoreInit.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    return unavailable();
  }

  if (response.status === 404) {
    return { ok: true, data: null, status: 404 };
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
      message: "Could not load your profile. Please try again.",
      status: response.status,
    };
  }

  const data = (await response.json()) as ProfilePublic;
  return { ok: true, data, status: response.status };
}

export async function backendPutProfile(
  accessToken: string,
  payload: ProfilePayload,
): Promise<BackendResult<ProfilePublic>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/profile`, {
      method: "PUT",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${accessToken}`,
      },
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
          : "Could not save your profile. Please try again.",
      status: response.status,
    };
  }

  const data = (await response.json()) as ProfilePublic;
  return { ok: true, data, status: response.status };
}

export async function backendDeleteProfile(
  accessToken: string,
): Promise<BackendResult<null>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/profile`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${accessToken}`,
      },
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
  if (!response.ok && response.status !== 204) {
    return {
      ok: false,
      kind: "unknown",
      message: "Could not delete your profile. Please try again.",
      status: response.status,
    };
  }

  return { ok: true, data: null, status: response.status === 204 ? 204 : response.status };
}
