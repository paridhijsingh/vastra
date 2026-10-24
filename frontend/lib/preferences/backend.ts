import { getApiUrl } from "@/lib/config";

export type PreferenceFailureKind = "validation" | "unauthorized" | "conflict" | "not_found" | "unavailable";

export type PreferenceBackendResult =
  | { ok: true; data: unknown; status: number }
  | { ok: false; kind: PreferenceFailureKind; message: string; status: number };

function failure(kind: PreferenceFailureKind, message: string, status: number): PreferenceBackendResult {
  return { ok: false, kind, message, status };
}

async function requestPreference(
  accessToken: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<PreferenceBackendResult> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return failure("unavailable", "Preferences could not be loaded. Please try again.", 503);
  }
  if (response.status === 401) return failure("unauthorized", "Your session has expired. Please sign in again.", 401);
  if (response.status === 404) return failure("not_found", "Preference not found.", 404);
  if (response.status === 409) return failure("conflict", "You can save at most 24 preferences.", 409);
  if (response.status === 422) return failure("validation", "Check the preference and try again.", 422);
  if (!response.ok) return failure("unavailable", "Preferences could not be saved. Please try again.", response.status);
  if (response.status === 204) return { ok: true, data: null, status: 204 };
  try {
    return { ok: true, data: await response.json(), status: response.status };
  } catch {
    return failure("unavailable", "Preferences could not be loaded. Please try again.", 502);
  }
}

export function backendListPreferences(accessToken: string): Promise<PreferenceBackendResult> {
  return requestPreference(accessToken, "/preferences", "GET");
}

export function backendCreatePreference(accessToken: string, body: unknown): Promise<PreferenceBackendResult> {
  return requestPreference(accessToken, "/preferences", "POST", body);
}

export function backendUpdatePreference(accessToken: string, preferenceId: string, body: unknown): Promise<PreferenceBackendResult> {
  return requestPreference(accessToken, `/preferences/${preferenceId}`, "PATCH", body);
}

export function backendDeletePreference(accessToken: string, preferenceId: string): Promise<PreferenceBackendResult> {
  return requestPreference(accessToken, `/preferences/${preferenceId}`, "DELETE");
}
