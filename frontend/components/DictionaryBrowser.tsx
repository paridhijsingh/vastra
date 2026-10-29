"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { DictionaryDeleteConfirm, DictionaryTermForm } from "@/components/DictionaryTermForm";
import {
  EMPTY_DICTIONARY_FORM,
  canManageDictionaryEntry,
  submitDictionaryForm,
  type DictionaryFieldErrors,
  type DictionaryFormValues,
} from "@/lib/dictionary/form";
import {
  DICTIONARY_KIND_LABELS,
  DICTIONARY_KINDS,
  DICTIONARY_LANES,
  groupDictionaryByKind,
  DICTIONARY_FILTER_NOTE,
  DICTIONARY_LOAD_ERROR,
  DICTIONARY_PRIVACY_NOTE,
  EMPTY_DICTIONARY_BODY,
  EMPTY_DICTIONARY_TITLE,
  NO_MATCH_TITLE,
  TERM_DELETED_MESSAGE,
  dictionaryListHref,
  hasActiveDictionaryFilters,
  parseDictionaryEntry,
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
  showDeletedNotice: boolean;
};

export function DictionaryBrowser({
  initialFilters,
  unsupportedStyle,
  unsupportedKind,
  showDeletedNotice,
}: Props) {
  const router = useRouter();
  const savingRef = useRef(false);
  const [q, setQ] = useState(initialFilters.q);
  const [style, setStyle] = useState<DictionaryStyle | "">(initialFilters.style);
  const [kind, setKind] = useState<DictionaryKind | "">(initialFilters.kind);
  const [tag, setTag] = useState(initialFilters.tag);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formValues, setFormValues] = useState<DictionaryFormValues>(EMPTY_DICTIONARY_FORM);
  const [fieldErrors, setFieldErrors] = useState<DictionaryFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function onCreate() {
    if (savingRef.current) return;
    const result = submitDictionaryForm(formValues);
    if (!result.ok || result.mode !== "create") {
      setFieldErrors(result.ok ? {} : result.fields);
      setFormError(null);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/dictionary", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(result.body),
      });
      const body = (await response.json().catch(() => ({}))) as {
        entry?: unknown;
        error?: string;
        fields?: DictionaryFieldErrors;
      };
      if (response.status === 401) {
        setFormError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/dictionary");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setFormError(body.error ?? "Could not add the term. Please try again.");
        if (body.fields) setFieldErrors(body.fields);
        return;
      }
      const created = parseDictionaryEntry(body.entry);
      if (!created) {
        setFormError("Could not add the term. Please try again.");
        return;
      }
      router.push(`/dictionary/${encodeURIComponent(created.id)}?added=1`);
      router.refresh();
    } catch {
      setFormError("The dictionary service is unavailable. Please try again later.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function onDelete(entry: DictionaryEntry) {
    if (savingRef.current || deletingId) return;
    setDeletingId(entry.id);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/dictionary/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        setDeleteError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/dictionary");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setDeleteError(body.error ?? "Could not delete the term. Please try again.");
        return;
      }
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setConfirmId(null);
      router.push("/dictionary?notice=deleted");
      router.refresh();
    } catch {
      setDeleteError("The dictionary service is unavailable. Please try again later.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtersActive = hasActiveDictionaryFilters({
    q: submittedQ,
    style: submittedStyle,
    kind: submittedKind,
    tag: submittedTag,
  });

  return (
    <div className="flex max-w-3xl min-w-0 flex-col gap-6">
      {showDeletedNotice ? (
        <p className="status-card text-base font-semibold text-foreground" role="status">
          {TERM_DELETED_MESSAGE}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="status-card text-sm text-muted">{DICTIONARY_PRIVACY_NOTE}</p>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding((open) => !open);
            setFormError(null);
            setFieldErrors({});
          }}
          className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Add a term
        </button>
        {adding ? (
          <div className="studio-fieldset">
            <h2 className="font-display text-2xl font-semibold text-foreground">Add a term</h2>
            <DictionaryTermForm
              values={formValues}
              errors={fieldErrors}
              formError={formError}
              status={null}
              saving={saving}
              submitLabel="Add a term"
              onChange={setFormValues}
              onSubmit={() => void onCreate()}
              onCancel={() => {
                setAdding(false);
                setFormError(null);
                setFieldErrors({});
              }}
            />
          </div>
        ) : null}
      </div>

      {unsupportedStyle ? (
        <p className="status-card text-sm text-accent-dictionary-text" role="alert">
          “{unsupportedStyle}” is not one of the broad styles. Those are Indian, Western, and fusion. Type a cultural or
          style tag in the tag field instead.
        </p>
      ) : null}
      {unsupportedKind ? (
        <p className="status-card text-sm text-accent-dictionary-text" role="alert">
          “{unsupportedKind}” is not a dictionary type.
        </p>
      ) : null}

      <form className="studio-fieldset" onSubmit={onSearch}>
        <div className="flex flex-col gap-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-dictionary-text">
            Browse
          </p>
          <h2 className="font-display text-xl font-semibold text-foreground">Find a term</h2>
          <p className="text-sm text-muted">{DICTIONARY_FILTER_NOTE}</p>
        </div>
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
            className="min-h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base text-foreground"
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
            className="min-h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base text-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p id="dictionary-lanes-label" className="text-sm font-semibold text-foreground">
            Style lane
          </p>
          <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-labelledby="dictionary-lanes-label">
            {DICTIONARY_LANES.map((lane) => {
              const active = style === lane.value;
              return (
                <button
                  key={lane.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStyle(lane.value);
                    router.push(dictionaryListHref({ q, style: lane.value, kind, tag }));
                  }}
                  className={[
                    "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-semibold transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:bg-black/5",
                  ].join(" ")}
                >
                  {lane.label}
                </button>
              );
            })}
          </div>
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
            className="min-h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base text-foreground"
          >
            <option value="">All types</option>
            {DICTIONARY_KINDS.map((value) => (
              <option key={value} value={value}>
                {DICTIONARY_KIND_LABELS[value]}
              </option>
            ))}
          </select>
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
            className="btn-secondary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold text-foreground"
          >
            Clear filters
          </Link>
        </div>
      </form>

      {loadState === "loading" ? (
        <p className="status-card text-base text-muted" role="status">
          Loading dictionary…
        </p>
      ) : null}

      {loadState === "error" ? (
        <div className="error-alert flex flex-col gap-3" role="alert">
          <p className="text-sm">{error ?? DICTIONARY_LOAD_ERROR}</p>
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
            className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loadState === "ready" && entries.length === 0 ? (
        <div className="status-card flex flex-col gap-3" role="status">
          {filtersActive ? (
            <>
              <p className="text-base font-semibold text-foreground">{NO_MATCH_TITLE}</p>
              <Link
                href="/dictionary"
                className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold text-foreground"
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
        <div className="flex min-w-0 flex-col gap-8">
          {groupDictionaryByKind(entries).map((group) => (
            <section key={group.kind} className="flex min-w-0 flex-col gap-4" aria-labelledby={`dictionary-${group.kind}`}>
              <h2 id={`dictionary-${group.kind}`} className="wardrobe-category-heading">
                {group.label}
              </h2>
              <ul className="flex min-w-0 flex-col gap-4">
                {group.entries.map((entry) => (
            <li key={entry.id}>
              <article className="studio-garment">
                <Link
                  href={`/dictionary/${encodeURIComponent(entry.id)}`}
                  className="flex min-w-0 flex-col gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-dictionary-text">
                    {DICTIONARY_KIND_LABELS[entry.kind]}
                  </p>
                  <h3 className="font-display text-2xl font-semibold leading-snug text-foreground break-words underline">
                    {entry.term}
                  </h3>
                  <p className="text-base text-foreground line-clamp-3">{entry.definition}</p>
                  {entry.styles.length > 0 ? (
                    <p className="text-sm text-muted">{entry.styles.join(" · ")}</p>
                  ) : null}
                  {entry.style_tags.length > 0 ? (
                    <span className="flex flex-wrap gap-2">
                      {entry.style_tags.map((tag) => (
                        <span
                          key={`${entry.id}-${tag}`}
                          className="rounded-sm bg-[#7a4e72]/10 px-2 py-1 text-sm font-semibold text-accent-dictionary-text"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
                {canManageDictionaryEntry(entry) ? (
                  confirmId === entry.id ? (
                    <DictionaryDeleteConfirm
                      term={entry.term}
                      busy={deletingId === entry.id}
                      error={deleteError}
                      onConfirm={() => void onDelete(entry)}
                      onCancel={() => {
                        setConfirmId(null);
                        setDeleteError(null);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/dictionary/${encodeURIComponent(entry.id)}?edit=1`}
                        className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmId(entry.id);
                          setDeleteError(null);
                        }}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10"
                      >
                        Delete
                      </button>
                    </div>
                  )
                ) : null}
              </article>
            </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
