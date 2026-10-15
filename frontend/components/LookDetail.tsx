"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { categoryLabel } from "@/lib/emergency/form";
import {
  LOOK_NAME_MAX,
  LOOK_NOTES_MAX,
  LOOK_OCCASION_MAX,
  LOOK_PLAN_NOTE,
  NO_LOOK_CHANGES,
  editLookRequest,
  type LookFieldErrors,
  type LookView,
} from "@/lib/looks/form";

type Props = {
  userId: string;
  lookId: string;
};

export function LookDetail({ userId, lookId }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const [look, setLook] = useState<LookView | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<LookFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMissing(false);
      setFailed(false);
      try {
        const response = await fetch(`/api/looks/${encodeURIComponent(lookId)}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) {
          router.push(`/signin?next=/looks/${lookId}`);
          return;
        }
        if (response.status === 404) {
          setMissing(true);
          setLook(null);
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const payload: unknown = await response.json();
        const next =
          payload && typeof payload === "object" && "look" in payload
            ? (payload as { look: LookView }).look
            : null;
        if (!next || typeof next.name !== "string" || !Array.isArray(next.items)) {
          setFailed(true);
          return;
        }
        setLook(next);
        setName(next.name);
        setOccasion(next.occasion ?? "");
        setNotes(next.notes ?? "");
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [lookId, router, userId]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!look || pendingRef.current) return;
    const decision = editLookRequest({
      pending: pendingRef.current,
      original: { name: look.name, occasion: look.occasion, notes: look.notes },
      name,
      occasion,
      notes,
    });
    if (decision.status === "blocked") return;
    if (decision.status === "invalid") {
      setErrors(decision.errors);
      setFormError(null);
      setFormStatus(null);
      return;
    }
    if (decision.status === "unchanged") {
      setErrors({});
      setFormError(null);
      setFormStatus(NO_LOOK_CHANGES);
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setErrors({});
    setFormError(null);
    setFormStatus(null);
    try {
      const response = await fetch(`/api/looks/${encodeURIComponent(look.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(decision.body),
      });
      if (response.status === 401) {
        router.push(`/signin?next=/looks/${look.id}`);
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as { error?: unknown; fields?: LookFieldErrors }) : {};
        setErrors(record.fields ?? {});
        setFormError(typeof record.error === "string" ? record.error : "The look could not be updated.");
        return;
      }
      const next =
        payload && typeof payload === "object" && "look" in payload
          ? (payload as { look: LookView }).look
          : null;
      if (!next || typeof next.name !== "string") {
        setFormError("The look could not be updated.");
        return;
      }
      setLook(next);
      setName(next.name);
      setOccasion(next.occasion ?? "");
      setNotes(next.notes ?? "");
      setEditing(false);
    } catch {
      setFormError("Saved looks are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!look || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/looks/${encodeURIComponent(look.id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push(`/signin?next=/looks/${look.id}`);
        return;
      }
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "The look could not be deleted.";
        setDeleteError(message);
        return;
      }
      router.push("/looks?deleted=1");
    } catch {
      setDeleteError("The look could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-base text-muted">
        Loading saved look…
      </p>
    );
  }
  if (missing) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p>That saved look could not be found.</p>
        <Link href="/looks" className="font-semibold text-primary underline">
          Back to Saved Looks
        </Link>
      </div>
    );
  }
  if (failed || !look) {
    return (
      <p role="alert" className="text-base text-accent-profile-text">
        Could not load this saved look.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight break-words">{look.name}</h2>
        {look.occasion ? <p className="text-base text-foreground">{look.occasion}</p> : null}
        {look.notes ? <p className="text-base text-foreground">{look.notes}</p> : null}
        <p className="text-sm text-muted">{LOOK_PLAN_NOTE}</p>
      </div>
      {look.removedItemNotice ? (
        <p role="status" className="max-w-2xl rounded-md border border-primary bg-surface px-4 py-4 text-base font-semibold">
          {look.removedItemNotice}
        </p>
      ) : null}
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
        {look.items.map((item, index) =>
          item.missing ? (
            <li key={`removed-${index}`} className="border-t-[3px] border-primary bg-surface px-4 py-4">
              <p className="font-display text-xl font-semibold">{item.label}</p>
            </li>
          ) : (
            <li key={`${item.name}-${index}`} className="flex min-w-0 flex-col gap-3 border-t-[3px] border-primary bg-surface px-4 py-4">
              <h3 className="font-display text-xl font-semibold break-words">{item.name}</h3>
              <dl className="grid gap-2 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-muted">Category</dt>
                  <dd>{categoryLabel(item.category)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-muted">Color</dt>
                  <dd>{item.color}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-muted">Notes</dt>
                  <dd className="break-words">{item.notes}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-muted">Availability</dt>
                  <dd>{item.availabilityLabel}</dd>
                </div>
              </dl>
            </li>
          ),
        )}
      </ul>

      {editing ? (
        <form onSubmit={(event) => void onSave(event)} noValidate className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${formId}-name`} className="text-sm font-semibold">
              Name
            </label>
            <input
              id={`${formId}-name`}
              required
              maxLength={LOOK_NAME_MAX}
              value={name}
              disabled={saving}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => setName(event.target.value)}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base"
            />
            {errors.name ? <p className="text-sm text-accent-profile-text">{errors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold">
              Occasion
            </label>
            <input
              id={`${formId}-occasion`}
              maxLength={LOOK_OCCASION_MAX}
              value={occasion}
              disabled={saving}
              onChange={(event) => setOccasion(event.target.value)}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base"
            />
            {errors.occasion ? <p className="text-sm text-accent-profile-text">{errors.occasion}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${formId}-notes`} className="text-sm font-semibold">
              Notes
            </label>
            <textarea
              id={`${formId}-notes`}
              maxLength={LOOK_NOTES_MAX}
              rows={4}
              value={notes}
              disabled={saving}
              onChange={(event) => setNotes(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base"
            />
            {errors.notes ? <p className="text-sm text-accent-profile-text">{errors.notes}</p> : null}
          </div>
          {formError ? (
            <p role="alert" className="text-base text-accent-profile-text">
              {formError}
            </p>
          ) : null}
          {formStatus ? (
            <p role="status" className="text-base text-foreground">
              {formStatus}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setName(look.name);
                setOccasion(look.occasion ?? "");
                setNotes(look.notes ?? "");
                setErrors({});
                setFormError(null);
                setFormStatus(null);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : confirmingDelete ? (
        <div className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4">
          <p>Delete {look.name}?</p>
          {deleteError ? (
            <p role="alert" className="text-base text-accent-profile-text">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void onDelete()}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#b94732]/50 px-5 text-base font-semibold text-accent-profile-text"
            >
              {deleting ? "Deleting…" : "Delete look"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setName(look.name);
              setOccasion(look.occasion ?? "");
              setNotes(look.notes ?? "");
              setEditing(true);
              setConfirmingDelete(false);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(true);
              setDeleteError(null);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#b94732]/50 px-5 text-base font-semibold text-accent-profile-text"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
