"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
    } catch {
      // Still clear local UI state even if the request fails.
    } finally {
      setPending(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-sm px-2.5 text-sm font-medium text-foreground underline-offset-4 hover:bg-black/5 hover:underline disabled:opacity-70 sm:px-3 sm:text-base"
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
