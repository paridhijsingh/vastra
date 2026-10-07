import { cookies } from "next/headers";

import { backendMe } from "@/lib/auth/backend";
import { AUTH_COOKIE_NAME, type PublicUser } from "@/lib/auth/cookies";

/**
 * Resolve the signed-in user via FastAPI /auth/me.
 * Does not return or expose the access token.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const result = await backendMe(token);
  if (!result.ok) {
    return null;
  }
  return result.data;
}
