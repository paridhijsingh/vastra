import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import {
  backendDeleteProfile,
  backendGetProfile,
  backendPutProfile,
} from "@/lib/profile/backend";
import {
  EMPTY_PROFILE,
  isPreferredStyle,
  isStylingPreference,
  type PreferredStyle,
  type ProfilePayload,
  type StylingPreference,
} from "@/lib/profile/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStringList(value: unknown, field: string, maxItems: number): string[] | string {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return `${field} must be a list.`;
  }
  if (value.length > maxItems) {
    return `${field} must contain at most ${maxItems} items.`;
  }
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return `${field} entries must be strings.`;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return `${field} entries must not be blank.`;
    }
    if (trimmed.length > 64) {
      return `${field} entries must be at most 64 characters.`;
    }
    items.push(trimmed);
  }
  return items;
}

function parsePayload(body: unknown): ProfilePayload | string {
  if (!body || typeof body !== "object") {
    return "Invalid request body.";
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record) {
    return "owner_id cannot be set by the client.";
  }

  const stylingRaw = record.styling_preference;
  if (typeof stylingRaw !== "string" || !isStylingPreference(stylingRaw)) {
    return "styling_preference must be men, women, or unisex.";
  }

  const stylesRaw = record.preferred_styles;
  if (stylesRaw === undefined || stylesRaw === null) {
    // allow omit → empty
  } else if (!Array.isArray(stylesRaw)) {
    return "preferred_styles must be a list.";
  } else if (stylesRaw.length > 3) {
    return "preferred_styles must contain at most 3 items.";
  }

  const preferred_styles: PreferredStyle[] = [];
  if (Array.isArray(stylesRaw)) {
    for (const entry of stylesRaw) {
      if (typeof entry !== "string" || !isPreferredStyle(entry)) {
        return "preferred_styles must be Indian, Western, and/or fusion.";
      }
      preferred_styles.push(entry);
    }
  }

  const preferred_colors = parseStringList(record.preferred_colors, "preferred_colors", 32);
  if (typeof preferred_colors === "string") return preferred_colors;
  const fit_preferences = parseStringList(record.fit_preferences, "fit_preferences", 32);
  if (typeof fit_preferences === "string") return fit_preferences;
  const comfort_preferences = parseStringList(
    record.comfort_preferences,
    "comfort_preferences",
    32,
  );
  if (typeof comfort_preferences === "string") return comfort_preferences;
  const clothing_to_avoid = parseStringList(record.clothing_to_avoid, "clothing_to_avoid", 32);
  if (typeof clothing_to_avoid === "string") return clothing_to_avoid;

  return {
    styling_preference: stylingRaw as StylingPreference,
    preferred_styles,
    preferred_colors,
    fit_preferences,
    comfort_preferences,
    clothing_to_avoid,
  };
}

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse(
      "Your session has expired. Please sign in again.",
    );
  }
  return token;
}

export async function GET() {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const result = await backendGetProfile(tokenOrResponse);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      { status: result.status === 503 ? 503 : 502 },
    );
  }

  return jsonPrivate({ profile: result.data }, { status: 200 });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if (typeof parsed === "string") {
    return jsonPrivate({ error: parsed, kind: "validation" }, { status: 422 });
  }

  const result = await backendPutProfile(tokenOrResponse, parsed);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      {
        status:
          result.kind === "validation"
            ? 422
            : result.kind === "unavailable"
              ? 503
              : 502,
      },
    );
  }

  return jsonPrivate({ profile: result.data }, { status: 200 });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const result = await backendDeleteProfile(tokenOrResponse);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      { status: result.kind === "unavailable" ? 503 : 502 },
    );
  }

  return jsonPrivate(
    { profile: null, empty: EMPTY_PROFILE },
    { status: 200 },
  );
}
