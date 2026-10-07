"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DICTIONARY_KIND_LABELS,
  DICTIONARY_LOAD_ERROR,
  MISSING_ENTRY_BODY,
  MISSING_ENTRY_TITLE,
  parseDictionaryEntry,
  type DictionaryEntry,
} from "@/lib/dictionary/types";

type LoadState = "loading" | "ready" | "missing" | "error";

type Props = {
  entryId: string;
};

export function DictionaryEntryView({ entryId }: Props) {
  const router = useRouter();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/dictionary/${encodeURIComponent(entryId)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        entry?: unknown;
        error?: string;
        kind?: string;
      };

      if (response.status === 401) {
        setError(body.error ?? "Your session has expired. Please sign in again.");
        setLoadState("error");
        router.push(
          `/signin?next=${encodeURIComponent(`/dictionary/${entryId}`)}`,
        );
        router.refresh();
        return;
      }

      if (response.status === 404 || body.kind === "not_found") {
        setEntry(null);
        setLoadState("missing");
        return;
      }

      if (!response.ok) {
        setError(body.error ?? DICTIONARY_LOAD_ERROR);
        setLoadState("error");
        return;
      }

      const parsed = parseDictionaryEntry(body.entry);
      if (!parsed) {
        setError(DICTIONARY_LOAD_ERROR);
        setLoadState("error");
        return;
      }

      setEntry(parsed);
      setLoadState("ready");
    } catch {
      setError("The dictionary service is unavailable. Please try again later.");
      setLoadState("error");
    }
  }, [entryId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadState === "loading") {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
        Loading dictionary entry…
      </p>
    );
  }

  if (loadState === "missing") {
    return (
      <div className="flex max-w-2xl flex-col gap-4" role="status">
        <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {MISSING_ENTRY_TITLE}
        </h1>
        <p className="text-lg text-muted">{MISSING_ENTRY_BODY}</p>
        <Link
          href="/dictionary"
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Back to the dictionary
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !entry) {
    return (
      <div className="flex max-w-2xl flex-col gap-3 rounded-md border border-[#b94732]/40 bg-[#b94732]/10 px-4 py-3" role="alert">
        <p className="text-sm text-accent-profile-text">{error ?? DICTIONARY_LOAD_ERROR}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <article className="flex max-w-2xl min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-dictionary-text">
          {DICTIONARY_KIND_LABELS[entry.kind]}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          {entry.term}
        </h1>
        <p className="text-lg text-foreground">{entry.definition}</p>
        <p className="text-sm text-muted">General guidance</p>
      </div>

      {entry.style_tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {entry.style_tags.map((tag) => (
            <li
              key={tag}
              className="rounded-sm bg-[#7a4e72]/10 px-2 py-1 text-sm font-semibold text-accent-dictionary-text"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <NoteList title="Also called" items={entry.aliases} />
      {entry.cultural_context ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold text-foreground">Cultural context</h2>
          <p className="text-base text-foreground">{entry.cultural_context}</p>
        </section>
      ) : null}
      <NoteList title="Pairing suggestions" items={entry.pairing_suggestions} />
      <NoteList title="Occasions" items={entry.occasions} />
      {entry.weather_notes.length > 0 || entry.comfort_notes.length > 0 ? (
        <p className="text-sm text-muted">
          Weather and comfort notes are suggestions. They depend on fabric weight, construction, fit, and personal preference.
        </p>
      ) : null}
      <NoteList title="Weather notes" items={entry.weather_notes} />
      <NoteList title="Comfort notes" items={entry.comfort_notes} />

      <Link
        href="/dictionary"
        className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground"
      >
        Back to the dictionary
      </Link>
    </article>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
