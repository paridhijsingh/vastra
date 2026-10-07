import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieState: { token: string | undefined } = { token: undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "vastra_access_token" && cookieState.token) {
        return { name, value: cookieState.token };
      }
      return undefined;
    },
  }),
}));

import {
  DELETE as deleteProfile,
  GET as getProfile,
  PUT as putProfile,
} from "@/app/api/profile/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { linesToList, listToLines } from "@/lib/profile/types";

const SAMPLE_PROFILE = {
  owner_id: "user-1",
  styling_preference: "women",
  preferred_styles: ["Indian", "fusion"],
  preferred_colors: ["navy", "cream"],
  fit_preferences: ["tailored"],
  comfort_preferences: ["breathable fabrics"],
  clothing_to_avoid: ["stilettos"],
};

function sameOriginHeaders(): HeadersInit {
  return {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
  };
}

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("profile list helpers", () => {
  it("converts lines and lists without inventing blank entries", () => {
    expect(linesToList("navy\n\n cream \n")).toEqual(["navy", "cream"]);
    expect(listToLines(["navy", "cream"])).toBe("navy\ncream");
    expect(linesToList("")).toEqual([]);
  });
});

describe("GET /api/profile", () => {
  it("rejects unauthenticated access and clears no cookie when none exists", async () => {
    const response = await getProfile();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.kind).toBe("unauthorized");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns profile: null when the backend has no profile (404)", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Profile not found" }, { status: 404 }),
      ),
    );

    const response = await getProfile();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("loads an existing profile without exposing the bearer token", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("Authorization");
      expect(auth).toBe("Bearer valid-token");
      return Response.json(SAMPLE_PROFILE);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getProfile();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.styling_preference).toBe("women");
    expect(body.profile.preferred_styles).toEqual(["Indian", "fusion"]);
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(JSON.stringify(body)).not.toContain("Bearer");
  });

  it("clears the session cookie when the backend rejects the token", async () => {
    cookieState.token = "expired-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Invalid or expired token" }, { status: 401 }),
      ),
    );

    const response = await getProfile();
    expect(response.status).toBe(401);
    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});

describe("PUT /api/profile", () => {
  it("rejects cross-origin saves", async () => {
    cookieState.token = "valid-token";
    const response = await putProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "PUT",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(SAMPLE_PROFILE),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("saves a profile through the backend and returns the saved record", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.method).toBe("PUT");
        const sent = JSON.parse(String(init?.body)) as typeof SAMPLE_PROFILE;
        expect(sent.styling_preference).toBe("unisex");
        expect(sent).not.toHaveProperty("owner_id");
        return Response.json({ ...SAMPLE_PROFILE, styling_preference: "unisex" });
      }),
    );

    const response = await putProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "PUT",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          styling_preference: "unisex",
          preferred_styles: ["Western"],
          preferred_colors: ["black"],
          fit_preferences: [],
          comfort_preferences: [],
          clothing_to_avoid: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.styling_preference).toBe("unisex");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("rejects client-supplied owner_id", async () => {
    cookieState.token = "valid-token";
    const response = await putProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "PUT",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          ...SAMPLE_PROFILE,
          owner_id: "someone-else",
        }),
      }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.kind).toBe("validation");
  });
});

describe("DELETE /api/profile", () => {
  it("rejects cross-origin deletes", async () => {
    cookieState.token = "valid-token";
    const response = await deleteProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "DELETE",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
        },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("deletes the profile and returns an empty-profile payload", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.method).toBe("DELETE");
        return new Response(null, { status: 204 });
      }),
    );

    const response = await deleteProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toBeNull();
    expect(body.empty.preferred_styles).toEqual([]);
  });

  it("rejects unauthenticated deletion", async () => {
    const response = await deleteProfile(
      new Request("http://localhost:3000/api/profile", {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
    );
    expect(response.status).toBe(401);
  });
});
