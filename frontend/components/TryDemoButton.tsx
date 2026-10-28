"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  nextPath?: string;
  className?: string;
};

export function TryDemoButton({
  nextPath = "/emergency-fit",
  className,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(
          payload.error ??
            (response.status === 503
              ? "Demo sign-in is not available right now."
              : "Could not start the demo. Please try again."),
        );
        return;
      }
      const destination = nextPath.startsWith("/") ? nextPath : "/emergency-fit";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Demo sign-in is not available right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className={
          className ??
          "btn-secondary inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        }
      >
        {pending ? "Starting demo…" : "Try the demo"}
      </button>
      {error ? (
        <p className="error-alert text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
