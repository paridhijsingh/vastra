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
  const [retryNonce, setRetryNonce] = useState(0);

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
  }, [router, userId, retryNonce]);

  if (loading) {
    return (
      <p role="status" className="status-card text-base text-muted">
        Loading saved looks…
      </p>
    );
  }
  if (failed) {
    return (
      <div className="error-alert flex max-w-2xl flex-col gap-3" role="alert">
        <p>Could not load your saved looks.</p>
        <button
          type="button"
          onClick={() => setRetryNonce((value) => value + 1)}
          className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showDeleted ? (
        <p role="status" className="status-card text-base text-foreground">
          {LOOK_DELETED_MESSAGE}
        </p>
      ) : null}
      {looks.length === 0 ? (
        <div className="status-card flex max-w-2xl flex-col gap-3">
          <p>You have no saved looks yet.</p>
          <p className="text-sm text-muted">Save an outfit from Stylist or Emergency Fit.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/stylist"
              className="btn-secondary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
            >
              Stylist
            </Link>
            <Link
              href="/emergency-fit"
              className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
            >
              Emergency Fit
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {looks.map((look) => {
            const pieces = lookPieceLine(look);
            return (
              <li key={look.id}>
                <article className="studio-garment h-full">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-wardrobe-text">
                    Saved look
                  </p>
                  <h2 className="font-display text-2xl font-semibold leading-snug break-words">
                    <Link href={`/looks/${look.id}`} className="text-foreground underline">
                      {look.name}
                    </Link>
                  </h2>
                  {look.occasion ? <p className="text-base text-foreground">{look.occasion}</p> : null}
                  {pieces ? <p className="text-sm text-muted">{pieces}</p> : null}
                  {look.removedItemNotice ? (
                    <p className="text-sm font-semibold text-foreground">{look.removedItemNotice}</p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function lookPieceLine(look: LookView): string | null {
  if (!Array.isArray(look.items) || look.items.length === 0) return null;
  const count = look.items.length;
  const countLabel = count === 1 ? "1 piece" : `${count} pieces`;
  const names = look.items.map((item) => (item.missing ? item.label : item.name)).filter(Boolean);
  return names.length > 0 ? `${countLabel} · ${names.join(" · ")}` : countLabel;
}
