import { getApiUrl } from "@/lib/config";
import type { PublicUser } from "@/lib/auth/cookies";

export type BackendErrorKind =
  | "validation"
  | "duplicate_username"
  | "invalid_credentials"
  | "unauthorized"
  | "unavailable"
  | "unknown";

export type BackendResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; kind: BackendErrorKind; message: string; status: number };

function mapError(status: number, detail: unknown): {
  kind: BackendErrorKind;
  message: string;
} {
  if (status === 409) {
    return {
      kind: "duplicate_username",
      message: "That username is already taken. Try another.",
    };
  }
  if (status === 401) {
    return {
      kind: "invalid_credentials",
      message: "Incorrect username or password.",
    };
  }
  if (status === 422) {
    return {
      kind: "validation",
      message: "Check your username and password and try again.",
    };
  }
  if (typeof detail === "string" && detail.trim()) {
    return { kind: "unknown", message: detail };
  }
  return {
    kind: "unknown",
    message: "Something went wrong. Please try again.",
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

export async function backendRegister(
  username: string,
  password: string,
): Promise<BackendResult<PublicUser>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      kind: "unavailable",
      message: "The authentication service is unavailable. Please try again later.",
      status: 503,
    };
  }

  if (response.status === 201) {
    const data = (await response.json()) as PublicUser;
    return { ok: true, data: { id: data.id, username: data.username }, status: 201 };
  }

  const detail = await readDetail(response);
  const mapped = mapError(response.status, detail);
  return { ok: false, ...mapped, status: response.status };
}

export async function backendLogin(
  username: string,
  password: string,
): Promise<BackendResult<{ accessToken: string }>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      kind: "unavailable",
      message: "The authentication service is unavailable. Please try again later.",
      status: 503,
    };
  }

  if (response.ok) {
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token || typeof data.access_token !== "string") {
      return {
        ok: false,
        kind: "unknown",
        message: "Something went wrong. Please try again.",
        status: 502,
      };
    }
    return { ok: true, data: { accessToken: data.access_token }, status: response.status };
  }

  const detail = await readDetail(response);
  const mapped = mapError(response.status, detail);
  if (response.status === 401) {
    return {
      ok: false,
      kind: "invalid_credentials",
      message: "Incorrect username or password.",
      status: 401,
    };
  }
  return { ok: false, ...mapped, status: response.status };
}

export async function backendMe(
  accessToken: string,
): Promise<BackendResult<PublicUser>> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      kind: "unavailable",
      message: "The authentication service is unavailable. Please try again later.",
      status: 503,
    };
  }

  if (response.ok) {
    const data = (await response.json()) as PublicUser;
    return { ok: true, data: { id: data.id, username: data.username }, status: response.status };
  }

  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "Your session has expired. Please sign in again.",
      status: 401,
    };
  }

  return {
    ok: false,
    kind: "unknown",
    message: "Something went wrong. Please try again.",
    status: response.status,
  };
}
