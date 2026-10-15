"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LOOK_DELETED_MESSAGE, type LookView } from "@/lib/looks/form";

type Props = {
  userId: string;
  showDeleted: boolean;
};

export function LooksPanel({ userId, showDeleted }: Props) {
  const router = useRouter();
  const [looks, setLooks] = useState<LookView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch("/api/looks", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) {
          router.push("/signin?next=/looks");
          return;
        }
        if (!response.ok) {
          setFailed(true);
          setLooks([]);
          return;
        }
        const payload: unknown = await response.json();
        const list =
          payload && typeof payload === "object" && Array.isArray((payload as { looks?: unknown }).looks)
            ? (payload as { looks: LookView[] }).looks
            : null;
        if (!list) {
          setFailed(true);
          setLooks([]);
          return;
        }
        setLooks(list);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLooks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  if (loading) {
    return (
      <p role="status" className="text-base text-muted">
        Loading saved looks…
      </p>
    );
  }
  if (failed) {
    return (
      <p role="alert" className="text-base text-accent-profile-text">
        Could not load your saved looks.
      </p>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showDeleted ? (
        <p role="status" className="text-base text-foreground">
          {LOOK_DELETED_MESSAGE}
        </p>
      ) : null}
      {looks.length === 0 ? (
        <div className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4">
          <p>You have no saved looks yet.</p>
          <Link href="/emergency-fit" className="font-semibold text-primary underline">
            Emergency Fit
          </Link>
        </div>
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {looks.map((look) => (
            <li key={look.id} className="border-t-[3px] border-primary bg-surface px-4 py-4">
              <h2 className="font-display text-2xl font-semibold break-words">
                <Link href={`/looks/${look.id}`} className="text-foreground underline">
                  {look.name}
                </Link>
              </h2>
              {look.occasion ? <p className="mt-2 text-base text-foreground">{look.occasion}</p> : null}
              {look.removedItemNotice ? (
                <p className="mt-2 text-sm font-semibold text-foreground">{look.removedItemNotice}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
