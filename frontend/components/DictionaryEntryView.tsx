"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DictionaryDeleteConfirm, DictionaryTermForm } from "@/components/DictionaryTermForm";
import {
  canManageDictionaryEntry,
  entryToForm,
  submitDictionaryForm,
  type DictionaryFieldErrors,
  type DictionaryFormValues,
} from "@/lib/dictionary/form";
import {
  DICTIONARY_KIND_LABELS,
  DICTIONARY_LOAD_ERROR,
  DICTIONARY_PRIVACY_NOTE,
  MISSING_ENTRY_BODY,
  MISSING_ENTRY_TITLE,
  NO_DICTIONARY_CHANGES_MESSAGE,
  TERM_ADDED_MESSAGE,
  parseDictionaryEntry,
  type DictionaryEntry,
} from "@/lib/dictionary/types";

type LoadState = "loading" | "ready" | "missing" | "error";

type Props = {
  entryId: string;
  showAddedNotice: boolean;
  startEditing: boolean;
};

export function DictionaryEntryView({ entryId, showAddedNotice, startEditing }: Props) {
  const router = useRouter();
  const savingRef = useRef(false);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(startEditing);
  const [formValues, setFormValues] = useState<DictionaryFormValues | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DictionaryFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(
    showAddedNotice ? TERM_ADDED_MESSAGE : null,
  );

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
      if (startEditing && canManageDictionaryEntry(parsed)) {
        setFormValues(entryToForm(parsed));
        setEditing(true);
      }
      setLoadState("ready");
    } catch {
      setError("The dictionary service is unavailable. Please try again later.");
      setLoadState("error");
    }
  }, [entryId, router, startEditing]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadState === "loading") {
    return (
      <p className="status-card text-base text-muted" role="status">
        Loading dictionary entry…
      </p>
    );
  }

  if (loadState === "missing") {
    return (
      <div className="status-card flex max-w-2xl flex-col gap-3" role="status">
        <h2 className="font-display text-2xl font-semibold text-foreground">{MISSING_ENTRY_TITLE}</h2>
        <p className="text-base text-muted">{MISSING_ENTRY_BODY}</p>
        <Link
          href="/dictionary"
          className="text-sm font-semibold text-primary underline"
        >
          Back to the dictionary
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !entry) {
    return (
      <div className="error-alert flex max-w-2xl flex-col gap-3" role="alert">
        <p className="text-sm">{error ?? DICTIONARY_LOAD_ERROR}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  function beginEdit() {
    if (!entry || !canManageDictionaryEntry(entry)) return;
    setFormValues(entryToForm(entry));
    setFieldErrors({});
    setFormError(null);
    setFormStatus(null);
    setEditing(true);
    setConfirmingDelete(false);
  }

  async function onSave() {
    if (!entry || !formValues || savingRef.current) return;
    const result = submitDictionaryForm(formValues, entry);
    if (!result.ok) {
      setFieldErrors(result.fields);
      setFormError(null);
      setFormStatus(null);
      return;
    }
    if (result.mode !== "edit" || result.patch === null) {
      setFieldErrors({});
      setFormError(null);
      setFormStatus(NO_DICTIONARY_CHANGES_MESSAGE);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setFormStatus(null);
    setFieldErrors({});
    try {
      const response = await fetch(`/api/dictionary/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(result.patch),
      });
      const body = (await response.json().catch(() => ({}))) as {
        entry?: unknown;
        error?: string;
        fields?: DictionaryFieldErrors;
      };
      if (response.status === 401) {
        setFormError(body.error ?? "Your session has expired. Please sign in again.");
        router.push(`/signin?next=${encodeURIComponent(`/dictionary/${entry.id}`)}`);
        router.refresh();
        return;
      }
      if (!response.ok) {
        setFormError(body.error ?? "Could not update the term. Please try again.");
        if (body.fields) setFieldErrors(body.fields);
        return;
      }
      const updated = parseDictionaryEntry(body.entry);
      if (!updated) {
        setFormError("Could not update the term. Please try again.");
        return;
      }
      setEntry(updated);
      setFormValues(entryToForm(updated));
      setEditing(false);
      setSavedNotice(null);
    } catch {
      setFormError("The dictionary service is unavailable. Please try again later.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!entry || savingRef.current || deleting) return;
    setDeleting(true);
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
        return;
      }
      if (!response.ok) {
        setDeleteError(body.error ?? "Could not delete the term. Please try again.");
        return;
      }
      router.push("/dictionary?notice=deleted");
      router.refresh();
    } catch {
      setDeleteError("The dictionary service is unavailable. Please try again later.");
    } finally {
      setDeleting(false);
    }
  }

  const manageable = canManageDictionaryEntry(entry);

  return (
    <article className="flex max-w-2xl min-w-0 flex-col gap-6">
      {savedNotice ? (
        <p className="status-card text-base font-semibold text-foreground" role="status">
          {savedNotice}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-dictionary-text">
          {DICTIONARY_KIND_LABELS[entry.kind]}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl">
          {entry.term}
        </h2>
        <p className="text-lg text-foreground">{entry.definition}</p>
        {entry.styles.length > 0 ? (
          <p className="text-base text-muted">Broad styles: {entry.styles.join(", ")}</p>
        ) : null}
        {manageable ? (
          <p className="status-card text-sm text-muted">{DICTIONARY_PRIVACY_NOTE}</p>
        ) : null}
        <p className="text-sm text-muted">General guidance</p>
      </div>

      {manageable && editing && formValues ? (
        <div className="studio-fieldset">
          <DictionaryTermForm
            values={formValues}
            errors={fieldErrors}
            formError={formError}
            status={formStatus}
            saving={saving}
            submitLabel="Save changes"
            onChange={setFormValues}
            onSubmit={() => void onSave()}
            onCancel={() => {
              setEditing(false);
              setFormError(null);
              setFormStatus(null);
              setFieldErrors({});
              setFormValues(entryToForm(entry));
            }}
          />
        </div>
      ) : null}

      {manageable && !editing ? (
        confirmingDelete ? (
          <DictionaryDeleteConfirm
            term={entry.term}
            busy={deleting}
            error={deleteError}
            onConfirm={() => void onDelete()}
            onCancel={() => {
              setConfirmingDelete(false);
              setDeleteError(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={beginEdit}
              className="btn-secondary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(true);
                setDeleteError(null);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#b94732]/50 px-5 text-base font-semibold text-accent-profile-text hover:bg-[#b94732]/10"
            >
              Delete
            </button>
          </div>
        )
      ) : null}

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
        <section className="studio-garment">
          <h3 className="font-display text-xl font-semibold text-foreground">Cultural context</h3>
          <p className="text-base text-foreground break-words">{entry.cultural_context}</p>
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
        className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold text-foreground"
      >
        Back to the dictionary
      </Link>
    </article>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="studio-garment">
      <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-foreground">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
