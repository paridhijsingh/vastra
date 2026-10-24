import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieState: { token: string | undefined } = { token: undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "vastra_access_token" && cookieState.token) return { name, value: cookieState.token };
      return undefined;
    },
  }),
}));

import { POST as createPreference } from "@/app/api/preferences/route";
import { reviewPreference } from "@/lib/preferences/form";

function sameOrigin(body: unknown): Request {
  return new Request("http://localhost:3000/api/preferences", {
    method: "POST",
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("preference review", () => {
  it("requires a statement before a preference can be saved", () => {
    const missing = reviewPreference({ topic: "comfort", statement: "  ", occasion: "" });
    expect(missing.status).toBe("invalid");
    const ready = reviewPreference({ topic: "comfort", statement: " Prefer flats ", occasion: " standing " });
    expect(ready).toEqual({ status: "ready", body: { topic: "comfort", statement: "Prefer flats", occasion: "standing" } });
  });
});

describe("POST /api/preferences", () => {
  it("requires a session and rejects an owner id", async () => {
    expect((await createPreference(sameOrigin({ topic: "comfort", statement: "Prefer flats" }))).status).toBe(401);
    cookieState.token = "session-token";
    const rejected = await createPreference(sameOrigin({ topic: "comfort", statement: "Prefer flats", owner_id: "spoof" }));
    expect(rejected.status).toBe(422);
  });
});
