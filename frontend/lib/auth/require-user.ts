import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/auth/cookies";

export async function requireUser(nextPath: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ next: nextPath });
    redirect(`/signin?${params.toString()}`);
  }
  return user;
}
