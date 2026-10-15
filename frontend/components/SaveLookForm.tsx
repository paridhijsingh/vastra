"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import {
  ATTACH_FAILED_MESSAGE,
  EVENT_MISSING_ATTACH_MESSAGE,
  runAttachLook,
  type EventFitContext,
} from "@/lib/emergency/event-fit";
import {
  DELETED_ITEM_SAVE_ERROR,
  LOOK_NAME_MAX,
  LOOK_NOTES_MAX,
  LOOK_OCCASION_MAX,
  LOOK_SAVED_MESSAGE,
  saveLookRequest,
  type LookFieldErrors,
} from "@/lib/looks/form";

type Props = {
  itemIds: readonly string[];
  defaultName: string;
  defaultOccasion: string;
  attachEvent?: EventFitContext | null;
};

export function SaveLookForm({ itemIds, defaultName, defaultOccasion, attachEvent = null }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName.slice(0, LOOK_NAME_MAX));
  const [occasion, setOccasion] = useState(defaultOccasion.slice(0, LOOK_OCCASION_MAX));
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<LookFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current || savedId) return;
    const decision = saveLookRequest({ pending: pendingRef.current, name, occasion, notes, itemIds });
    if (decision.status === "blocked") return;
    if (decision.status === "invalid") {
      setErrors(decision.errors);
      setFormError(null);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch("/api/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(decision.body),
      });
      if (response.status === 401) {
        router.push("/signin?next=/looks");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as { error?: unknown; kind?: unknown; fields?: LookFieldErrors }) : {};
        setErrors(record.fields ?? {});
        setFormError(
          record.kind === "not_found"
            ? DELETED_ITEM_SAVE_ERROR
            : typeof record.error === "string"
              ? record.error
              : "The look could not be saved.",
        );
        return;
      }
      const look =
        payload && typeof payload === "object" && "look" in payload
          ? (payload as { look: { id?: unknown } }).look
          : null;
      if (!look || typeof look.id !== "string") {
        setFormError("Saved looks are temporarily unavailable. Please try again later.");
        return;
      }
      setSavedId(look.id);
    } catch {
      setFormError("Saved looks are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground"
      >
        Save a look
      </button>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-name`} className="text-sm font-semibold text-foreground">
          Name
        </label>
        <input
          id={`${formId}-name`}
          required
          maxLength={LOOK_NAME_MAX}
          value={name}
          disabled={pending || Boolean(savedId)}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => setName(event.target.value)}
          className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        />
        {errors.name ? <p className="text-sm text-accent-profile-text">{errors.name}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold text-foreground">
          Occasion
        </label>
        <p id={`${formId}-occasion-hint`} className="text-sm text-muted">
          Optional.
        </p>
        <input
          id={`${formId}-occasion`}
          maxLength={LOOK_OCCASION_MAX}
          value={occasion}
          disabled={pending || Boolean(savedId)}
          aria-describedby={`${formId}-occasion-hint`}
          aria-invalid={errors.occasion ? true : undefined}
          onChange={(event) => setOccasion(event.target.value)}
          className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        />
        {errors.occasion ? <p className="text-sm text-accent-profile-text">{errors.occasion}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-notes`} className="text-sm font-semibold text-foreground">
          Notes
        </label>
        <p id={`${formId}-notes-hint`} className="text-sm text-muted">
          Optional.
        </p>
        <textarea
          id={`${formId}-notes`}
          maxLength={LOOK_NOTES_MAX}
          rows={3}
          value={notes}
          disabled={pending || Boolean(savedId)}
          aria-describedby={`${formId}-notes-hint`}
          aria-invalid={errors.notes ? true : undefined}
          onChange={(event) => setNotes(event.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
        />
        {errors.notes ? <p className="text-sm text-accent-profile-text">{errors.notes}</p> : null}
      </div>
      {formError ? (
        <p role="alert" className="text-base text-accent-profile-text">
          {formError}
        </p>
      ) : null}
      {savedId ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-base text-foreground">
            {LOOK_SAVED_MESSAGE}{" "}
            <Link href={`/looks/${savedId}`} className="font-semibold text-primary underline">
              View saved look
            </Link>
          </p>
          {attachEvent ? <AttachLook event={attachEvent} lookId={savedId} /> : null}
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      )}
    </form>
  );
}

function AttachLook({ event, lookId }: { event: EventFitContext; lookId: string }) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [hasLook, setHasLook] = useState(event.hasLook);
  const [confirming, setConfirming] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(confirmed: boolean) {
    if (pendingRef.current || attached || missing) return;
    pendingRef.current = true;
    setAttaching(true);
    setError(null);
    try {
      const outcome = await runAttachLook({
        pending: false,
        savedLookId: lookId,
        hasLook,
        confirmed,
        fetchEvent: async () => {
          const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, { cache: "no-store" });
          const payload: unknown = await response.json().catch(() => null);
          const next =
            payload && typeof payload === "object" && "event" in payload
              ? (payload as { event: { lookId?: unknown } }).event
              : null;
          return {
            status: response.status,
            lookId: next && typeof next.lookId === "string" ? next.lookId : null,
          };
        },
        patchEvent: async (body) => {
          const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
          });
          return { status: response.status };
        },
      });
      if (outcome.status === "unauthorized") {
        router.push(`/signin?next=${encodeURIComponent(`/emergency-fit?event=${encodeURIComponent(event.id)}`)}`);
        return;
      }
      if (outcome.status === "confirm") {
        setHasLook(true);
        setConfirming(true);
        return;
      }
      if (outcome.status === "attached") {
        setAttached(true);
        setConfirming(false);
        return;
      }
      if (outcome.status === "missing") {
        setMissing(true);
        setConfirming(false);
        return;
      }
      if (outcome.status === "failed") {
        setError(ATTACH_FAILED_MESSAGE);
      }
    } catch {
      setError(ATTACH_FAILED_MESSAGE);
    } finally {
      pendingRef.current = false;
      setAttaching(false);
    }
  }

  if (missing) {
    return (
      <p role="alert" className="text-base text-accent-profile-text">
        {EVENT_MISSING_ATTACH_MESSAGE}
      </p>
    );
  }
  if (attached) {
    return (
      <p role="status" className="text-base text-foreground">
        Look attached.{" "}
        <Link href={`/events/${event.id}`} className="font-semibold text-primary underline">
          Back to this event
        </Link>
      </p>
    );
  }
  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4">
        <p>Replace the saved look on {event.name}? The previous look stays in Saved Looks.</p>
        {error ? (
          <p role="alert" className="text-base text-accent-profile-text">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={attaching}
            onClick={() => void submit(true)}
            className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold disabled:opacity-70"
          >
            {attaching ? "Attaching…" : "Replace look"}
          </button>
          <button
            type="button"
            disabled={attaching}
            onClick={() => setConfirming(false)}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-base text-accent-profile-text">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={attaching}
        onClick={() => {
          if (hasLook) {
            setConfirming(true);
            return;
          }
          void submit(false);
        }}
        className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground disabled:opacity-70"
      >
        {attaching ? "Attaching…" : "Attach to this event"}
      </button>
    </div>
  );
}
