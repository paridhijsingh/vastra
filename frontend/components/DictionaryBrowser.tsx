"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  DICTIONARY_KIND_LABELS,
  DICTIONARY_KINDS,
  DICTIONARY_FILTER_NOTE,
  DICTIONARY_LOAD_ERROR,
  DICTIONARY_STYLES,
  EMPTY_DICTIONARY_BODY,
  EMPTY_DICTIONARY_TITLE,
  NO_MATCH_TITLE,
  dictionaryListHref,
  hasActiveDictionaryFilters,
  parseDictionaryList,
  type DictionaryEntry,
  type DictionaryFilters,
  type DictionaryKind,
  type DictionaryStyle,
} from "@/lib/dictionary/types";

type LoadState = "loading" | "ready" | "error";

type Props = {
  initialFilters: DictionaryFilters;
  unsupportedStyle: string | null;
  unsupportedKind: string | null;
};

export function DictionaryBrowser({
  initialFilters,
  unsupportedStyle,
  unsupportedKind,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialFilters.q);
  const [style, setStyle] = useState<DictionaryStyle | "">(initialFilters.style);
  const [kind, setKind] = useState<DictionaryKind | "">(initialFilters.kind);
  const [tag, setTag] = useState(initialFilters.tag);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const submittedQ = initialFilters.q;
  const submittedStyle = initialFilters.style;
  const submittedKind = initialFilters.kind;
  const submittedTag = initialFilters.tag;

  const load = useCallback(
    async (filters: DictionaryFilters) => {
      setLoadState("loading");
      setError(null);
      const href = dictionaryListHref(filters);
      const query = href.startsWith("/dictionary?") ? href.slice("/dictionary".length) : "";
      try {
        const response = await fetch(`/api/dictionary${query}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as {
          entries?: unknown;
          error?: string;
        };

        if (response.status === 401) {
          setError(body.error ?? "Your session has expired. Please sign in again.");
          setLoadState("error");
          router.push(`/signin?next=${encodeURIComponent(href)}`);
          router.refresh();
          return;
        }

        if (!response.ok) {
          setError(body.error ?? DICTIONARY_LOAD_ERROR);
          setLoadState("error");
          return;
        }

        const parsed = parseDictionaryList(body.entries ?? []);
        if (!parsed) {
          setError(DICTIONARY_LOAD_ERROR);
          setLoadState("error");
          return;
        }

        setEntries(parsed);
        setLoadState("ready");
      } catch {
        setError("The dictionary service is unavailable. Please try again later.");
        setLoadState("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const filters = {
      q: submittedQ,
      style: submittedStyle,
      kind: submittedKind,
      tag: submittedTag,
    };
    setQ(submittedQ);
    setStyle(submittedStyle);
    setKind(submittedKind);
    setTag(submittedTag);
    void load(filters);
  }, [submittedQ, submittedStyle, submittedKind, submittedTag, load]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(dictionaryListHref({ q, style, kind, tag }));
  }

  const filtersActive = hasActiveDictionaryFilters({
    q: submittedQ,
    style: submittedStyle,
    kind: submittedKind,
    tag: submittedTag,
  });

  return (
    <div className="flex max-w-3xl min-w-0 flex-col gap-6">
      <p className="text-sm text-muted">{DICTIONARY_FILTER_NOTE}</p>

      {unsupportedStyle ? (
        <p className="rounded-md border border-[#7a4e72]/40 bg-[#7a4e72]/10 px-4 py-3 text-sm text-accent-dictionary-text" role="alert">
          “{unsupportedStyle}” is not one of the broad styles. Those are Indian, Western, and fusion. Type a cultural or style tag in the tag field instead.
        </p>
      ) : null}
      {unsupportedKind ? (
        <p className="rounded-md border border-[#7a4e72]/40 bg-[#7a4e72]/10 px-4 py-3 text-sm text-accent-dictionary-text" role="alert">
          “{unsupportedKind}” is not a dictionary type.
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSearch}>
        <div className="flex flex-col gap-2">
          <label htmlFor="dictionary-q" className="text-sm font-semibold text-foreground">
            Search
          </label>
          <input
            id="dictionary-q"
            name="q"
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="dictionary-tag" className="text-sm font-semibold text-foreground">
            Cultural or style tag
          </label>
          <p id="dictionary-tag-hint" className="text-sm text-muted">
            Filter by a tag used in the collection.
          </p>
          <input
            id="dictionary-tag"
            name="tag"
            type="text"
            value={tag}
            aria-describedby="dictionary-tag-hint"
            onChange={(event) => setTag(event.target.value)}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="dictionary-style" className="text-sm font-semibold text-foreground">
              Style
            </label>
            <select
              id="dictionary-style"
              name="style"
              value={style}
              onChange={(event) => {
                const value = event.target.value;
                setStyle(
                  value === "Indian" || value === "Western" || value === "fusion" ? value : "",
                );
              }}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            >
              <option value="">All styles</option>
              {DICTIONARY_STYLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="dictionary-kind" className="text-sm font-semibold text-foreground">
              Type
            </label>
            <select
              id="dictionary-kind"
              name="kind"
              value={kind}
              onChange={(event) => {
                const value = event.target.value;
                setKind(
                  value === "garment" ||
                    value === "fabric" ||
                    value === "silhouette" ||
                    value === "styling_technique"
                    ? value
                    : "",
                );
              }}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            >
              <option value="">All types</option>
              {DICTIONARY_KINDS.map((value) => (
                <option key={value} value={value}>
                  {DICTIONARY_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
          >
            Search
          </button>
          <Link
            href="/dictionary"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground"
          >
            Clear filters
          </Link>
        </div>
      </form>

      {loadState === "loading" ? (
        <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
          Loading dictionary…
        </p>
      ) : null}

      {loadState === "error" ? (
        <div className="flex flex-col gap-3 rounded-md border border-[#b94732]/40 bg-[#b94732]/10 px-4 py-3" role="alert">
          <p className="text-sm text-accent-profile-text">{error ?? DICTIONARY_LOAD_ERROR}</p>
          <button
            type="button"
            onClick={() =>
              void load({
                q: submittedQ,
                style: submittedStyle,
                kind: submittedKind,
                tag: submittedTag,
              })
            }
            className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loadState === "ready" && entries.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4" role="status">
          {filtersActive ? (
            <>
              <p className="text-base font-semibold text-foreground">{NO_MATCH_TITLE}</p>
              <Link
                href="/dictionary"
                className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold text-foreground"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-foreground">{EMPTY_DICTIONARY_TITLE}</p>
              <p className="text-base text-muted">{EMPTY_DICTIONARY_BODY}</p>
            </>
          )}
        </div>
      ) : null}

      {loadState === "ready" && entries.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/dictionary/${encodeURIComponent(entry.id)}`}
                className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-4 hover:border-[#7a4e72]/50"
              >
                <span className="font-display text-2xl font-semibold text-foreground">
                  {entry.term}
                </span>
                <span className="text-base text-foreground">{entry.definition}</span>
                {entry.style_tags.length > 0 ? (
                  <span className="flex flex-wrap gap-2">
                    {entry.style_tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm bg-[#7a4e72]/10 px-2 py-1 text-sm font-semibold text-accent-dictionary-text"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
