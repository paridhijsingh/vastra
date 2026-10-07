import { NextResponse } from "next/server";

import { backendRegister } from "@/lib/auth/backend";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

export const runtime = "nodejs";

type Body = {
  username?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (username.length < 3 || username.length > 64) {
    return NextResponse.json(
      { error: "Username must be between 3 and 64 characters." },
      { status: 400 },
    );
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  const result = await backendRegister(username, password);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, kind: result.kind },
      { status: result.status === 409 ? 409 : result.status === 422 ? 422 : result.status === 503 ? 503 : 400 },
    );
  }

  // Registration does not create a session; user must sign in.
  return NextResponse.json(
    { user: { id: result.data.id, username: result.data.username } },
    { status: 201 },
  );
}
