"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import {
  PREFERENCE_OCCASION_MAX,
  PREFERENCE_STATEMENT_MAX,
  TOPIC_LABELS,
  TOPICS,
  preferenceFromApi,
  reviewPreference,
  type PreferenceDraft,
  type PreferenceFieldErrors,
  type PreferenceView,
} from "@/lib/preferences/form";

type Props = { userId: string };

const EMPTY: PreferenceDraft = { topic: "comfort", statement: "", occasion: "" };

export function PreferencesPanel({ userId }: Props) {
  const router = useRouter();
  const formId = useId();
  const [preferences, setPreferences] = useState<PreferenceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PreferenceDraft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [review, setReview] = useState<PreferenceDraft | null>(null);
  const [errors, setErrors] = useState<PreferenceFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/preferences", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/signin?next=/preferences");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (cancelled) return;
      if (!response.ok || !payload || typeof payload !== "object" || !Array.isArray((payload as { preferences?: unknown }).preferences)) {
        setLoadError("Preferences could not be loaded. Please try again.");
        setLoading(false);
        return;
      }
      const parsed = (payload as { preferences: unknown[] }).preferences.map(preferenceFromApi);
      if (parsed.some((item) => item === null)) {
        setLoadError("Preferences could not be loaded. Please try again.");
      } else {
        setPreferences(parsed as PreferenceView[]);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  function startReview() {
    const decision = reviewPreference(draft);
    if (decision.status === "invalid") {
      setErrors(decision.errors);
      setReview(null);
      return;
    }
    setErrors({});
    setFormError(null);
    setReview({ topic: decision.body.topic, statement: decision.body.statement, occasion: decision.body.occasion ?? "" });
  }

  async function saveReviewed() {
    if (!review || pending) return;
    const decision = reviewPreference(review);
    if (decision.status === "invalid") return;
    setPending(true);
    setFormError(null);
    const response = await fetch(editingId ? `/api/preferences/${editingId}` : "/api/preferences", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(decision.body),
    });
    setPending(false);
    if (response.status === 401) {
      router.push("/signin?next=/preferences");
      return;
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Preferences could not be saved. Please try again.";
      setFormError(message);
      return;
    }
    const saved = preferenceFromApi(payload && typeof payload === "object" ? (payload as { preference?: unknown }).preference : null);
    if (!saved) {
      setFormError("Preferences could not be saved. Please try again.");
      return;
    }
    setPreferences((current) => editingId ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]);
    setDraft(EMPTY);
    setEditingId(null);
    setReview(null);
  }

  async function remove(preferenceId: string) {
    setPending(true);
    setFormError(null);
    const response = await fetch(`/api/preferences/${preferenceId}`, { method: "DELETE", cache: "no-store" });
    setPending(false);
    if (response.status === 401) {
      router.push("/signin?next=/preferences");
      return;
    }
    if (!response.ok) {
      setFormError("The preference could not be deleted. Please try again.");
      return;
    }
    setPreferences((current) => current.filter((item) => item.id !== preferenceId));
    setPendingDeleteId(null);
    if (editingId === preferenceId) {
      setEditingId(null);
      setDraft(EMPTY);
      setReview(null);
    }
  }

  return (
    <div className="flex min-w-0 max-w-2xl flex-col gap-8">
      {loading ? <p role="status" className="text-base text-muted">Loading preferences…</p> : null}
      {loadError ? <p role="alert" className="text-base text-accent-profile-text">{loadError}</p> : null}
      {!loading && !loadError && preferences.length === 0 ? (
        <p role="status" className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted">
          No saved preferences yet. A preference is guidance for later outfits. It does not change which clothes you own or what is available.
        </p>
      ) : null}
      {preferences.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {preferences.map((preference) => (
            <li key={preference.id} className="rounded-md border border-border bg-surface px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-profile-text">{TOPIC_LABELS[preference.topic]}</p>
              <p className="mt-2 text-base text-foreground">{preference.statement}</p>
              {preference.occasion ? <p className="text-sm text-muted">Occasion: {preference.occasion}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold"
                  onClick={() => {
                    setEditingId(preference.id);
                    setDraft({ topic: preference.topic, statement: preference.statement, occasion: preference.occasion });
                    setReview(null);
                    setErrors({});
                  }}
                >
                  Edit
                </button>
                {pendingDeleteId === preference.id ? (
                  <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold" onClick={() => void remove(preference.id)} disabled={pending}>
                    Delete this preference
                  </button>
                ) : (
                  <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold" onClick={() => setPendingDeleteId(preference.id)}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (review) void saveReviewed();
          else startReview();
        }}
      >
        <h2 className="font-display text-2xl font-semibold">{editingId ? "Edit preference" : "New preference"}</h2>
        <label htmlFor={`${formId}-topic`} className="text-base font-semibold">Topic</label>
        <select
          id={`${formId}-topic`}
          value={draft.topic}
          onChange={(event) => {
            if (event.target.value === "comfort" || event.target.value === "avoid" || event.target.value === "style" || event.target.value === "fit" || event.target.value === "color" || event.target.value === "occasion") {
              setDraft({ ...draft, topic: event.target.value });
              setReview(null);
            }
          }}
          className="min-h-12 rounded-md border border-border bg-background px-3"
        >
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>{TOPIC_LABELS[topic]}</option>
          ))}
        </select>
        <label htmlFor={`${formId}-statement`} className="text-base font-semibold">Preference</label>
        <textarea
          id={`${formId}-statement`}
          value={draft.statement}
          maxLength={PREFERENCE_STATEMENT_MAX}
          rows={3}
          aria-invalid={errors.statement ? true : undefined}
          aria-describedby={errors.statement ? `${formId}-statement-error` : undefined}
          onChange={(event) => {
            setDraft({ ...draft, statement: event.target.value });
            setReview(null);
          }}
          className="min-h-24 rounded-md border border-border bg-background px-3 py-3"
        />
        {errors.statement ? <p id={`${formId}-statement-error`} role="alert" className="text-base text-accent-profile-text">{errors.statement}</p> : null}
        <label htmlFor={`${formId}-occasion`} className="text-base font-semibold">Occasion, if it applies</label>
        <input
          id={`${formId}-occasion`}
          value={draft.occasion}
          maxLength={PREFERENCE_OCCASION_MAX}
          onChange={(event) => {
            setDraft({ ...draft, occasion: event.target.value });
            setReview(null);
          }}
          className="min-h-12 rounded-md border border-border bg-background px-3"
        />
        {errors.occasion ? <p role="alert" className="text-base text-accent-profile-text">{errors.occasion}</p> : null}
        {review ? (
          <div className="rounded-md border border-border bg-surface px-4 py-4" role="status">
            <p className="text-base font-semibold">Review before saving</p>
            <p className="mt-2 text-base">{TOPIC_LABELS[review.topic]}: {review.statement}</p>
            {review.occasion ? <p className="text-sm text-muted">Occasion: {review.occasion}</p> : null}
            <p className="mt-2 text-sm text-muted">This is guidance for later outfits. It does not change ownership or availability.</p>
          </div>
        ) : null}
        {formError ? <p role="alert" className="text-base text-accent-profile-text">{formError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {review ? (
            <>
              <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-12 items-center rounded-md px-5 text-base font-semibold disabled:opacity-60">
                {pending ? "Saving…" : "Save preference"}
              </button>
              <button type="button" className="inline-flex min-h-12 items-center rounded-md border border-border px-5 text-base font-semibold" onClick={() => setReview(null)}>
                Keep editing
              </button>
            </>
          ) : (
            <button type="submit" className="btn-primary inline-flex min-h-12 items-center rounded-md px-5 text-base font-semibold">
              Review preference
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
