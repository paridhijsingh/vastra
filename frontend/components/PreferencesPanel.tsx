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
      {loading ? (
        <p role="status" className="status-card text-base text-muted">
          Loading preferences…
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="error-alert text-base">
          {loadError}
        </p>
      ) : null}
      {!loading && !loadError && preferences.length === 0 ? (
        <p role="status" className="status-card text-base text-muted">
          No saved preferences yet. A preference is guidance for later outfits. It does not change which clothes you own or what is available.
        </p>
      ) : null}
      {preferences.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {preferences.map((preference) => (
            <li key={preference.id} className="studio-garment">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-profile-text">
                {TOPIC_LABELS[preference.topic]}
              </p>
              <p className="text-base text-foreground break-words">{preference.statement}</p>
              {preference.occasion ? (
                <p className="text-sm text-muted">Occasion: {preference.occasion}</p>
              ) : null}
              {pendingDeleteId === preference.id ? (
                <div
                  className="error-alert flex flex-col gap-3"
                  role="alertdialog"
                  aria-labelledby={`${formId}-delete-${preference.id}`}
                >
                  <p id={`${formId}-delete-${preference.id}`} className="text-sm font-semibold text-foreground">
                    Delete this preference? This cannot be undone.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10 disabled:opacity-70"
                      onClick={() => void remove(preference.id)}
                      disabled={pending}
                    >
                      {pending ? "Deleting…" : "Delete this preference"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold"
                      onClick={() => setPendingDeleteId(null)}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold"
                    onClick={() => {
                      setEditingId(preference.id);
                      setDraft({
                        topic: preference.topic,
                        statement: preference.statement,
                        occasion: preference.occasion,
                      });
                      setReview(null);
                      setErrors({});
                      setPendingDeleteId(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10"
                    onClick={() => setPendingDeleteId(preference.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="studio-fieldset gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (review) void saveReviewed();
          else startReview();
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-profile-text">
            {editingId ? "Edit" : "New"}
          </p>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {editingId ? "Edit preference" : "New preference"}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-topic`} className="text-sm font-semibold text-foreground">
            Topic
          </label>
          <select
            id={`${formId}-topic`}
            value={draft.topic}
            onChange={(event) => {
              if (
                event.target.value === "comfort" ||
                event.target.value === "avoid" ||
                event.target.value === "style" ||
                event.target.value === "fit" ||
                event.target.value === "color" ||
                event.target.value === "occasion"
              ) {
                setDraft({ ...draft, topic: event.target.value });
                setReview(null);
              }
            }}
            className="min-h-12 rounded-md border border-border bg-background px-3 text-base text-foreground"
          >
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {TOPIC_LABELS[topic]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-statement`} className="text-sm font-semibold text-foreground">
            Preference
          </label>
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
            className="min-h-24 rounded-md border border-border bg-background px-3 py-3 text-base text-foreground"
          />
          {errors.statement ? (
            <p id={`${formId}-statement-error`} role="alert" className="text-sm text-accent-profile-text">
              {errors.statement}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold text-foreground">
            Occasion, if it applies
          </label>
          <input
            id={`${formId}-occasion`}
            value={draft.occasion}
            maxLength={PREFERENCE_OCCASION_MAX}
            onChange={(event) => {
              setDraft({ ...draft, occasion: event.target.value });
              setReview(null);
            }}
            className="min-h-12 rounded-md border border-border bg-background px-3 text-base text-foreground"
          />
          {errors.occasion ? (
            <p role="alert" className="text-sm text-accent-profile-text">
              {errors.occasion}
            </p>
          ) : null}
        </div>
        {review ? (
          <div className="status-card flex flex-col gap-2" role="status">
            <p className="text-sm font-semibold text-foreground">Review before saving</p>
            <p className="text-base text-foreground">
              {TOPIC_LABELS[review.topic]}: {review.statement}
            </p>
            {review.occasion ? <p className="text-sm text-muted">Occasion: {review.occasion}</p> : null}
            <p className="text-sm text-muted">
              This is guidance for later outfits. It does not change ownership or availability.
            </p>
          </div>
        ) : null}
        {formError ? (
          <p role="alert" className="error-alert text-sm">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {review ? (
            <>
              <button
                type="submit"
                disabled={pending}
                className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto"
              >
                {pending ? "Saving…" : "Save preference"}
              </button>
              <button
                type="button"
                className="btn-secondary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto"
                onClick={() => setReview(null)}
              >
                Keep editing
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto"
            >
              Review preference
            </button>
          )}
          {editingId && !review ? (
            <button
              type="button"
              className="btn-secondary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY);
                setReview(null);
                setErrors({});
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
