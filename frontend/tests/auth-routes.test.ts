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

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";

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

describe("auth API routes", () => {
  it("rejects cross-origin login", async () => {
    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ username: "stylefan", password: "securepass1" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("registers without setting a session cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ id: "user-1", username: "stylefan" }, { status: 201 }),
      ),
    );

    const response = await registerPost(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ username: "stylefan", password: "securepass1" }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.username).toBe("stylefan");
    expect(body).not.toHaveProperty("access_token");
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("logs in by setting an HttpOnly cookie and omitting the token from the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "secret-token-value",
          token_type: "bearer",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "user-1", username: "stylefan" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ username: "stylefan", password: "securepass1" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({ id: "user-1", username: "stylefan" });
    expect(JSON.stringify(body)).not.toContain("secret-token-value");
    expect(body).not.toHaveProperty("access_token");

    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("secret-token-value");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("maps invalid credentials without leaking passwords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "Incorrect username or password" },
          { status: 401 },
        ),
      ),
    );

    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          username: "stylefan",
          password: "wrong-password",
        }),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.kind).toBe("invalid_credentials");
    expect(JSON.stringify(body)).not.toContain("wrong-password");
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("clears the session cookie on logout without claiming backend revocation", async () => {
    const response = await logoutPost(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: sameOriginHeaders(),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(String(body.message).toLowerCase()).toContain("not revoked");
    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("clears the cookie when /auth/me rejects an expired session", async () => {
    cookieState.token = "expired-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Invalid or expired token" }, { status: 401 }),
      ),
    );

    const response = await meGet();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(JSON.stringify(body)).not.toContain("expired-token");
    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
