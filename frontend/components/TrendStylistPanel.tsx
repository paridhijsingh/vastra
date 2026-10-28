"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import {
  BUDGET_MAX,
  OCCASION_MAX,
  SEARCHING_TRENDS_MESSAGE,
  TREND_UNAVAILABLE_MESSAGE,
  VIBE_MAX,
  generationRequest,
  ideaFromProxy,
  type TrendFieldErrors,
  type TrendIdeaView,
} from "@/lib/trends/form";

type Props = {
  userId: string;
};

export function TrendStylistPanel({ userId }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const occasionRef = useRef<HTMLInputElement>(null);
  const [occasion, setOccasion] = useState("dinner with friends");
  const [vibe, setVibe] = useState("relaxed");
  const [budget, setBudget] = useState("no shopping");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<TrendFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<TrendIdeaView | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = generationRequest({
      pending: pendingRef.current,
      occasion,
      vibe,
      budget,
    });
    if (decision.status === "blocked") {
      return;
    }
    if (decision.status === "invalid") {
      setErrors(decision.errors);
      setFormError(null);
      if (decision.errors.occasion) {
        occasionRef.current?.focus();
      }
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setErrors({});
    setFormError(null);
    setResult(null);
    try {
      const response = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision.body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent("/trends")}`);
        return;
      }
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        const fields =
          record.fields && typeof record.fields === "object" ? (record.fields as TrendFieldErrors) : {};
        setErrors(fields);
        setFormError(
          typeof record.error === "string" && record.error.trim()
            ? record.error
            : TREND_UNAVAILABLE_MESSAGE,
        );
        return;
      }
      const idea = ideaFromProxy(payload);
      if (!idea) {
        setFormError(TREND_UNAVAILABLE_MESSAGE);
        return;
      }
      setResult(idea);
    } catch {
      setFormError(TREND_UNAVAILABLE_MESSAGE);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <form
        id={`${formId}-form`}
        onSubmit={onSubmit}
        noValidate
        className="flex min-w-0 max-w-2xl flex-col gap-5"
        aria-describedby="trend-stylist-purpose"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold text-foreground">
            Occasion
          </label>
          <input
            ref={occasionRef}
            id={`${formId}-occasion`}
            name="occasion"
            required
            maxLength={OCCASION_MAX}
            value={occasion}
            disabled={pending}
            aria-invalid={errors.occasion ? true : undefined}
            aria-describedby={errors.occasion ? `${formId}-occasion-error` : undefined}
            onChange={(event) => setOccasion(event.target.value)}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
          {errors.occasion ? (
            <p id={`${formId}-occasion-error`} className="text-sm text-accent-profile-text">
              {errors.occasion}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-vibe`} className="text-sm font-semibold text-foreground">
            Vibe
          </label>
          <input
            id={`${formId}-vibe`}
            name="vibe"
            required
            maxLength={VIBE_MAX}
            value={vibe}
            disabled={pending}
            aria-invalid={errors.vibe ? true : undefined}
            aria-describedby={errors.vibe ? `${formId}-vibe-error` : undefined}
            onChange={(event) => setVibe(event.target.value)}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
          {errors.vibe ? (
            <p id={`${formId}-vibe-error`} className="text-sm text-accent-profile-text">
              {errors.vibe}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-budget`} className="text-sm font-semibold text-foreground">
            Budget
          </label>
          <p id={`${formId}-budget-hint`} className="text-sm text-muted">
            Used only as a constraint. The page will not invent a price.
          </p>
          <input
            id={`${formId}-budget`}
            name="budget"
            required
            maxLength={BUDGET_MAX}
            value={budget}
            disabled={pending}
            aria-invalid={errors.budget ? true : undefined}
            aria-describedby={errors.budget ? `${formId}-budget-error` : `${formId}-budget-hint`}
            onChange={(event) => setBudget(event.target.value)}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
          {errors.budget ? (
            <p id={`${formId}-budget-error`} className="text-sm text-accent-profile-text">
              {errors.budget}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="error-alert text-sm">
            {formError}
          </p>
        ) : null}
        {pending ? (
          <p role="status" className="status-card text-sm font-semibold text-primary">
            {SEARCHING_TRENDS_MESSAGE}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Find a trend look
        </button>
      </form>

      {result ? <TrendIdeaCard key={`${userId}-${result.retrievalDate}`} idea={result} /> : null}
    </div>
  );
}

function TrendIdeaCard({ idea }: { idea: TrendIdeaView }) {
  return (
    <section className="status-card flex max-w-2xl min-w-0 flex-col gap-4" aria-labelledby="trend-idea-heading">
      <div className="flex flex-col gap-1">
        <h2 id="trend-idea-heading" className="font-display text-xl font-semibold text-foreground">
          Outfit idea
        </h2>
        <p className="text-sm text-muted">{idea.basedOn}</p>
      </div>
      <p className="text-base text-foreground">{idea.outfitIdea}</p>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Sources</h3>
        <ul className="flex flex-col gap-2">
          {idea.sources.map((source) => (
            <li key={source.url} className="text-sm">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
              >
                {source.title}
              </a>
              <p className="text-muted">
                {source.publishedDate
                  ? `Published ${source.publishedDate}. Retrieved ${source.retrievedDate}.`
                  : `Retrieved ${source.retrievedDate}.`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
