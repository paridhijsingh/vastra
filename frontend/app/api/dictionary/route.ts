import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { backendListDictionary } from "@/lib/dictionary/backend";
import {
  isDictionaryKind,
  isDictionaryStyle,
  type DictionaryFilters,
} from "@/lib/dictionary/types";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const styleRaw = searchParams.get("style");
  const kindRaw = searchParams.get("kind");

  if (styleRaw !== null && styleRaw !== "" && !isDictionaryStyle(styleRaw)) {
    return jsonPrivate(
      {
        error:
          "style must be Indian, Western, or fusion. Other cultural styles are not filters.",
        kind: "validation",
      },
      { status: 422 },
    );
  }
  if (kindRaw !== null && kindRaw !== "" && !isDictionaryKind(kindRaw)) {
    return jsonPrivate(
      {
        error:
          "kind must be garment, fabric, silhouette, or styling_technique.",
        kind: "validation",
      },
      { status: 422 },
    );
  }

  const filters: DictionaryFilters = {
    q,
    style: styleRaw && isDictionaryStyle(styleRaw) ? styleRaw : "",
    kind: kindRaw && isDictionaryKind(kindRaw) ? kindRaw : "",
    tag,
  };

  const result = await backendListDictionary(tokenOrResponse, filters);
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

  return jsonPrivate({ entries: result.data }, { status: 200 });
}
