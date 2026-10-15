"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  EVENT_DELETED_MESSAGE,
  EVENT_NAME_MAX,
  EVENT_NOTES_MAX,
  EVENT_OCCASION_MAX,
  EVENT_SAVED_MESSAGE,
  NO_SAVED_LOOK_LABEL,
  displayCalendarDate,
  saveEventRequest,
  type EventFieldErrors,
  type EventView,
  type LookChoice,
} from "@/lib/events/form";

type Props = {
  userId: string;
  showDeleted: boolean;
};

const EMPTY = {
  name: "",
  eventDate: "",
  occasion: "",
  notes: "",
  comfortText: "",
  lookId: "",
};

export function EventsPanel({ userId, showDeleted }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const [events, setEvents] = useState<EventView[]>([]);
  const [looks, setLooks] = useState<LookChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [looksNote, setLooksNote] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<EventFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      setLooksNote(null);
      try {
        const [eventsResponse, looksResponse] = await Promise.all([
          fetch("/api/events", { cache: "no-store" }),
          fetch("/api/looks", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (eventsResponse.status === 401 || looksResponse.status === 401) {
          router.push("/signin?next=/events");
          return;
        }
        if (!eventsResponse.ok) {
          setFailed(true);
          setEvents([]);
        } else {
          const payload: unknown = await eventsResponse.json();
          const list =
            payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events)
              ? (payload as { events: EventView[] }).events
              : null;
          if (!list) {
            setFailed(true);
            setEvents([]);
          } else {
            setEvents(list);
          }
        }
        if (!looksResponse.ok) {
          setLooks([]);
          setLooksNote("Could not load your saved looks. You can still save an event without one.");
        } else {
          const payload: unknown = await looksResponse.json();
          const list =
            payload && typeof payload === "object" && Array.isArray((payload as { looks?: unknown }).looks)
              ? (payload as { looks: LookChoice[] }).looks
              : null;
          if (!list) {
            setLooks([]);
            setLooksNote("Could not load your saved looks. You can still save an event without one.");
          } else {
            setLooks(list.map((look) => ({ id: look.id, name: look.name })));
          }
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, userId, status]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const decision = saveEventRequest({ pending: pendingRef.current, ...form });
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
    setStatus(null);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(decision.body),
      });
      if (response.status === 401) {
        router.push("/signin?next=/events");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as { error?: unknown; fields?: EventFieldErrors }) : {};
        setErrors(record.fields ?? {});
        setFormError(typeof record.error === "string" ? record.error : "The event could not be saved.");
        return;
      }
      setForm(EMPTY);
      setStatus(EVENT_SAVED_MESSAGE);
    } catch {
      setFormError("Saved events are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex max-w-2xl flex-col gap-4">
        <EventFields
          formId={formId}
          values={form}
          errors={errors}
          looks={looks}
          disabled={pending}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        />
        {looksNote ? <p className="text-sm text-muted">{looksNote}</p> : null}
        {formError ? (
          <p role="alert" className="text-base text-accent-profile-text">
            {formError}
          </p>
        ) : null}
        {status ? (
          <p role="status" className="text-base text-foreground">
            {status}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Saving…" : "Save event"}
        </button>
      </form>

      {loading ? (
        <p role="status" className="text-base text-muted">
          Loading saved events…
        </p>
      ) : failed ? (
        <p role="alert" className="text-base text-accent-profile-text">
          Could not load your saved events.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {showDeleted ? (
            <p role="status" className="text-base text-foreground">
              {EVENT_DELETED_MESSAGE}
            </p>
          ) : null}
          {events.length === 0 ? (
            <p className="max-w-2xl rounded-md border border-border bg-surface px-4 py-4">You have no saved events yet.</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-4">
              {events.map((item) => (
                <li key={item.id} className="border-t-[3px] border-primary bg-surface px-4 py-4">
                  <h2 className="font-display text-2xl font-semibold break-words">
                    <Link href={`/events/${item.id}`} className="text-foreground underline">
                      {item.name}
                    </Link>
                  </h2>
                  <p className="mt-2 text-base text-foreground">
                    <time dateTime={item.eventDate}>{displayCalendarDate(item.eventDate)}</time>
                  </p>
                  {item.occasion ? <p className="mt-1 text-base text-foreground">{item.occasion}</p> : null}
                  {item.lookId && item.lookName ? (
                    <p className="mt-2 text-sm text-foreground">
                      Saved look:{" "}
                      <Link href={`/looks/${item.lookId}`} className="font-semibold text-primary underline">
                        {item.lookName}
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function EventFields({
  formId,
  values,
  errors,
  looks,
  disabled,
  onChange,
}: {
  formId: string;
  values: typeof EMPTY;
  errors: EventFieldErrors;
  looks: LookChoice[];
  disabled: boolean;
  onChange: (patch: Partial<typeof EMPTY>) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-name`} className="text-sm font-semibold text-foreground">
          Name
        </label>
        <input
          id={`${formId}-name`}
          required
          maxLength={EVENT_NAME_MAX}
          value={values.name}
          disabled={disabled}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => onChange({ name: event.target.value })}
          className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        />
        {errors.name ? <p className="text-sm text-accent-profile-text">{errors.name}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-date`} className="text-sm font-semibold text-foreground">
          Event date
        </label>
        <input
          id={`${formId}-date`}
          type="date"
          required
          value={values.eventDate}
          disabled={disabled}
          aria-invalid={errors.event_date ? true : undefined}
          onChange={(event) => onChange({ eventDate: event.target.value })}
          className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        />
        {errors.event_date ? <p className="text-sm text-accent-profile-text">{errors.event_date}</p> : null}
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
          maxLength={EVENT_OCCASION_MAX}
          value={values.occasion}
          disabled={disabled}
          aria-describedby={`${formId}-occasion-hint`}
          onChange={(event) => onChange({ occasion: event.target.value })}
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
          maxLength={EVENT_NOTES_MAX}
          rows={3}
          value={values.notes}
          disabled={disabled}
          aria-describedby={`${formId}-notes-hint`}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
        />
        {errors.notes ? <p className="text-sm text-accent-profile-text">{errors.notes}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-comfort`} className="text-sm font-semibold text-foreground">
          Comfort needs
        </label>
        <p id={`${formId}-comfort-hint`} className="text-sm text-muted">
          Optional. Enter one comfort need per line.
        </p>
        <textarea
          id={`${formId}-comfort`}
          rows={3}
          value={values.comfortText}
          disabled={disabled}
          aria-describedby={`${formId}-comfort-hint`}
          aria-invalid={errors.comfort_needs ? true : undefined}
          onChange={(event) => onChange({ comfortText: event.target.value })}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
        />
        {errors.comfort_needs ? <p className="text-sm text-accent-profile-text">{errors.comfort_needs}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${formId}-look`} className="text-sm font-semibold text-foreground">
          Saved Look
        </label>
        <select
          id={`${formId}-look`}
          value={values.lookId}
          disabled={disabled}
          onChange={(event) => onChange({ lookId: event.target.value })}
          className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
        >
          <option value="">{NO_SAVED_LOOK_LABEL}</option>
          {looks.map((look) => (
            <option key={look.id} value={look.id}>
              {look.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
