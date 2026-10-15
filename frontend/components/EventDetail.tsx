"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { EventFields } from "@/components/EventsPanel";
import { emergencyFitEventPath } from "@/lib/emergency/event-fit";
import {
  NO_EVENT_CHANGES,
  REMOVED_LOOK_LABEL,
  displayCalendarDate,
  editEventRequest,
  type EventFieldErrors,
  type EventView,
  type LookChoice,
} from "@/lib/events/form";

type Props = {
  userId: string;
  eventId: string;
};

export function EventDetail({ userId, eventId }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const [event, setEvent] = useState<EventView | null>(null);
  const [looks, setLooks] = useState<LookChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");
  const [comfortText, setComfortText] = useState("");
  const [lookId, setLookId] = useState("");
  const [errors, setErrors] = useState<EventFieldErrors>({});
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
        const [eventResponse, looksResponse] = await Promise.all([
          fetch(`/api/events/${encodeURIComponent(eventId)}`, { cache: "no-store" }),
          fetch("/api/looks", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (eventResponse.status === 401 || looksResponse.status === 401) {
          router.push(`/signin?next=/events/${eventId}`);
          return;
        }
        if (eventResponse.status === 404) {
          setMissing(true);
          setEvent(null);
          return;
        }
        if (!eventResponse.ok) {
          setFailed(true);
          return;
        }
        const payload: unknown = await eventResponse.json();
        const next =
          payload && typeof payload === "object" && "event" in payload
            ? (payload as { event: EventView }).event
            : null;
        if (!next || typeof next.name !== "string" || typeof next.eventDate !== "string") {
          setFailed(true);
          return;
        }
        setEvent(next);
        setName(next.name);
        setEventDate(next.eventDate);
        setOccasion(next.occasion ?? "");
        setNotes(next.notes ?? "");
        setComfortText(next.comfortNeeds.join("\n"));
        setLookId(next.lookId ?? "");
        if (looksResponse.ok) {
          const looksPayload: unknown = await looksResponse.json();
          const list =
            looksPayload && typeof looksPayload === "object" && Array.isArray((looksPayload as { looks?: unknown }).looks)
              ? (looksPayload as { looks: LookChoice[] }).looks
              : [];
          setLooks(list.map((look) => ({ id: look.id, name: look.name })));
        } else {
          setLooks([]);
        }
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
  }, [eventId, router, userId]);

  async function onSave(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (!event || pendingRef.current) return;
    const decision = editEventRequest({
      pending: pendingRef.current,
      original: event,
      name,
      eventDate,
      occasion,
      notes,
      comfortText,
      lookId,
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
      setFormStatus(NO_EVENT_CHANGES);
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setErrors({});
    setFormError(null);
    setFormStatus(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(decision.body),
      });
      if (response.status === 401) {
        router.push(`/signin?next=/events/${event.id}`);
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as { error?: unknown; fields?: EventFieldErrors }) : {};
        setErrors(record.fields ?? {});
        setFormError(typeof record.error === "string" ? record.error : "The event could not be updated.");
        return;
      }
      const next =
        payload && typeof payload === "object" && "event" in payload
          ? (payload as { event: EventView }).event
          : null;
      if (!next || typeof next.name !== "string" || typeof next.eventDate !== "string") {
        setFormError("The event could not be updated.");
        return;
      }
      setEvent(next);
      setName(next.name);
      setEventDate(next.eventDate);
      setOccasion(next.occasion ?? "");
      setNotes(next.notes ?? "");
      setComfortText((next.comfortNeeds ?? []).join("\n"));
      setLookId(next.lookId ?? "");
      setEditing(false);
    } catch {
      setFormError("Saved events are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!event || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push(`/signin?next=/events/${event.id}`);
        return;
      }
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "The event could not be deleted.";
        setDeleteError(message);
        return;
      }
      router.push("/events?deleted=1");
    } catch {
      setDeleteError("The event could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-base text-muted">
        Loading saved event…
      </p>
    );
  }
  if (missing) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p>That saved event could not be found.</p>
        <Link href="/events" className="font-semibold text-primary underline">
          Back to Events
        </Link>
      </div>
    );
  }
  if (failed || !event) {
    return (
      <p role="alert" className="text-base text-accent-profile-text">
        Could not load this saved event.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight break-words">{event.name}</h2>
        <p className="text-base text-foreground">
          <time dateTime={event.eventDate}>{displayCalendarDate(event.eventDate)}</time>
        </p>
        {event.occasion ? <p className="text-base text-foreground">{event.occasion}</p> : null}
        {event.notes ? <p className="text-base text-foreground">{event.notes}</p> : null}
        {event.comfortNeeds.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">Comfort needs</h3>
            <ul className="list-disc pl-5 text-base text-foreground">
              {event.comfortNeeds.map((need, index) => (
                <li key={`${index}-${need}`}>{need}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {event.lookId && event.lookName ? (
          <p className="text-base text-foreground">
            Saved look:{" "}
            <Link href={`/looks/${event.lookId}`} className="font-semibold text-primary underline">
              {event.lookName}
            </Link>
          </p>
        ) : event.lookId ? (
          <p className="text-base text-foreground">{REMOVED_LOOK_LABEL}</p>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={(submitEvent) => void onSave(submitEvent)} noValidate className="flex max-w-2xl flex-col gap-4">
          <EventFields
            formId={formId}
            values={{ name, eventDate, occasion, notes, comfortText, lookId }}
            errors={errors}
            looks={lookChoicesForEvent(looks, event)}
            disabled={saving}
            onChange={(patch) => {
              if (patch.name !== undefined) setName(patch.name);
              if (patch.eventDate !== undefined) setEventDate(patch.eventDate);
              if (patch.occasion !== undefined) setOccasion(patch.occasion);
              if (patch.notes !== undefined) setNotes(patch.notes);
              if (patch.comfortText !== undefined) setComfortText(patch.comfortText);
              if (patch.lookId !== undefined) setLookId(patch.lookId);
            }}
          />
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
                setName(event.name);
                setEventDate(event.eventDate);
                setOccasion(event.occasion ?? "");
                setNotes(event.notes ?? "");
                setComfortText(event.comfortNeeds.join("\n"));
                setLookId(event.lookId ?? "");
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
          <p>Delete {event.name}?</p>
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
              {deleting ? "Deleting…" : "Delete event"}
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
          <Link
            href={emergencyFitEventPath(event.id)}
            className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
          >
            Suggest an outfit
          </Link>
          <button
            type="button"
            onClick={() => {
              setName(event.name);
              setEventDate(event.eventDate);
              setOccasion(event.occasion ?? "");
              setNotes(event.notes ?? "");
              setComfortText(event.comfortNeeds.join("\n"));
              setLookId(event.lookId ?? "");
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

function lookChoicesForEvent(looks: LookChoice[], event: EventView): LookChoice[] {
  if (!event.lookId || !event.lookName || looks.some((look) => look.id === event.lookId)) {
    return looks;
  }
  return [{ id: event.lookId, name: event.lookName }, ...looks];
}
