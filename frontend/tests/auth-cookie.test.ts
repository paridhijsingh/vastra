import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/lib/auth/same-origin";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearedAuthCookieOptions,
} from "@/lib/auth/cookies";

describe("isSameOriginRequest", () => {
  it("accepts matching Origin", () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects cross-site Origin", () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
      },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("accepts same-origin Sec-Fetch-Site when Origin is absent", () => {
    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });
});

describe("auth cookie options", () => {
  it("uses HttpOnly and SameSite=Lax", () => {
    const options = authCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(typeof options.maxAge).toBe("number");
    expect((options.maxAge as number) > 0).toBe(true);
  });

  it("clears cookies with maxAge 0", () => {
    const options = clearedAuthCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.maxAge).toBe(0);
  });

  it("uses a stable cookie name", () => {
    expect(AUTH_COOKIE_NAME).toBe("vastra_access_token");
  });
});
