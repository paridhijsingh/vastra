import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { getAuthCookieMaxAgeSeconds, isProduction } from "@/lib/config";

export const AUTH_COOKIE_NAME = "vastra_access_token";

export type PublicUser = {
  id: string;
  username: string;
};

export function authCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: getAuthCookieMaxAgeSeconds(),
  };
}

export function clearedAuthCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  };
}
