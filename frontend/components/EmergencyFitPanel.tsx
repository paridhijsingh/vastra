"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { SaveLookForm } from "@/components/SaveLookForm";
import { emergencyFitFields, type EventFitContext } from "@/lib/emergency/event-fit";
import {
  AI_SUGGESTION_NOTE,
  CREATING_OUTFIT_MESSAGE,
  EMERGENCY_FIT_EXPLANATION,
  NO_AVAILABLE_ITEMS_MESSAGE,
  PROFILE_MISSING_MESSAGE,
  WARDROBE_LOAD_ERROR,
  canGenerateOutfit,
  categoryLabel,
  generationRequest,
  renderedOutfitFromProxy,
  wardrobeGate,
  type EmergencyFieldErrors,
  type EmergencyOutfitView,
} from "@/lib/emergency/form";

type Props = {
  userId: string;
  returnPath: string;
  event?: EventFitContext | null;
};

export function EmergencyFitPanel({ userId, returnPath, event = null }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const occasionRef = useRef<HTMLInputElement>(null);
  const fields = emergencyFitFields(event);
  const [occasion, setOccasion] = useState(fields.occasion);
  const [vibe, setVibe] = useState(fields.vibe);
  const [comfortText, setComfortText] = useState(fields.comfortText);
  const [pending, setPending] = useState(false);
  const [wardrobeLoading, setWardrobeLoading] = useState(true);
  const [wardrobeFailed, setWardrobeFailed] = useState(false);
  const [availableCount, setAvailableCount] = useState(0);
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<EmergencyFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<EmergencyOutfitView | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setWardrobeLoading(true);
      setWardrobeFailed(false);
      setProfileNote(null);
      try {
        const [wardrobeResponse, profileResponse] = await Promise.all([
          fetch("/api/wardrobe?availability=available", { cache: "no-store" }),
          fetch("/api/profile", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (wardrobeResponse.status === 401 || profileResponse.status === 401) {
          router.push(`/signin?next=${encodeURIComponent(returnPath)}`);
          return;
        }
        if (!wardrobeResponse.ok) {
          setWardrobeFailed(true);
          setAvailableCount(0);
        } else {
          const wardrobeBody: unknown = await wardrobeResponse.json();
          const items =
            wardrobeBody &&
            typeof wardrobeBody === "object" &&
            Array.isArray((wardrobeBody as { items?: unknown }).items)
              ? (wardrobeBody as { items: unknown[] }).items
              : null;
          if (!items) {
            setWardrobeFailed(true);
            setAvailableCount(0);
          } else {
            setWardrobeFailed(false);
            setAvailableCount(items.length);
          }
        }
        if (profileResponse.ok) {
          const profileBody: unknown = await profileResponse.json();
          const profile =
            profileBody && typeof profileBody === "object" && "profile" in profileBody
              ? (profileBody as { profile: unknown }).profile
              : undefined;
          setProfileMissing(profile == null);
          setProfileNote(null);
        } else {
          setProfileMissing(false);
          setProfileNote("Could not check your style profile. You can still generate an outfit.");
        }
      } catch {
        if (!cancelled) {
          setWardrobeFailed(true);
          setAvailableCount(0);
        }
      } finally {
        if (!cancelled) {
          setWardrobeLoading(false);
        }
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [returnPath, router, userId]);

  const gate = wardrobeGate({
    loading: wardrobeLoading,
    failed: wardrobeFailed,
    availableCount,
  });
  const generateEnabled = canGenerateOutfit(gate, pending);

  async function reloadWardrobe() {
    setWardrobeLoading(true);
    setWardrobeFailed(false);
    try {
      const response = await fetch("/api/wardrobe?availability=available", { cache: "no-store" });
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!response.ok) {
        setWardrobeFailed(true);
        setAvailableCount(0);
        return;
      }
      const body: unknown = await response.json();
      const items =
        body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
          ? (body as { items: unknown[] }).items
          : null;
      if (!items) {
        setWardrobeFailed(true);
        setAvailableCount(0);
        return;
      }
      setAvailableCount(items.length);
    } catch {
      setWardrobeFailed(true);
      setAvailableCount(0);
    } finally {
      setWardrobeLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = generationRequest({
      pending: pendingRef.current,
      occasion,
      vibe,
      comfortText,
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
    if (!generateEnabled) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setErrors({});
    setFormError(null);
    setResult(null);
    try {
      const response = await fetch("/api/outfits/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision.body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        const fields =
          record.fields && typeof record.fields === "object"
            ? (record.fields as EmergencyFieldErrors)
            : {};
        setErrors(fields);
        setFormError(
          typeof record.error === "string" && record.error.trim()
            ? record.error
            : "The outfit suggestion could not be used. Please try again.",
        );
        return;
      }
      const outfit = renderedOutfitFromProxy(payload);
      if (!outfit) {
        setFormError("The outfit suggestion could not be used. Please try again.");
        return;
      }
      setResult(outfit);
    } catch {
      setFormError("Outfit suggestions are temporarily unavailable. Please try again later.");
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
        aria-describedby={`${formId}-explain`}
      >
        <p id={`${formId}-explain`} className="text-base text-muted">
          {EMERGENCY_FIT_EXPLANATION}
        </p>
        {event ? (
          <p className="text-base text-foreground">
            Styling for {event.name}.{" "}
            <Link href={`/events/${event.id}`} className="font-semibold text-primary underline">
              Back to this event
            </Link>
          </p>
        ) : null}

        {gate.status === "loading" ? (
          <p role="status" className="text-base text-muted">
            Loading wardrobe…
          </p>
        ) : null}
        {gate.status === "error" ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4" role="alert">
            <p>{WARDROBE_LOAD_ERROR}</p>
            <button
              type="button"
              onClick={() => {
                void reloadWardrobe();
              }}
              className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold text-foreground"
            >
              Try again
            </button>
          </div>
        ) : null}
        {gate.status === "empty" ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4" role="status">
            <p>{NO_AVAILABLE_ITEMS_MESSAGE}</p>
            <Link
              href="/wardrobe"
              className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold text-foreground"
            >
              Go to Wardrobe
            </Link>
          </div>
        ) : null}
        {profileMissing ? (
          <p className="text-base text-muted">
            {PROFILE_MISSING_MESSAGE}{" "}
            <Link href="/profile" className="font-semibold text-primary underline">
              Style Profile
            </Link>
          </p>
        ) : null}
        {profileNote ? <p className="text-base text-muted">{profileNote}</p> : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold text-foreground">
            Occasion
          </label>
          <input
            ref={occasionRef}
            id={`${formId}-occasion`}
            name="occasion"
            required
            maxLength={200}
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
          <p id={`${formId}-vibe-hint`} className="text-sm text-muted">
            Optional. Leave blank if you have no preference.
          </p>
          <input
            id={`${formId}-vibe`}
            name="vibe"
            maxLength={200}
            value={vibe}
            disabled={pending}
            aria-invalid={errors.vibe ? true : undefined}
            aria-describedby={errors.vibe ? `${formId}-vibe-error` : `${formId}-vibe-hint`}
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
          <label htmlFor={`${formId}-comfort`} className="text-sm font-semibold text-foreground">
            Comfort needs
          </label>
          <p id={`${formId}-comfort-hint`} className="text-sm text-muted">
            Optional. Enter one comfort need per line.
          </p>
          <textarea
            id={`${formId}-comfort`}
            name="comfort_needs"
            rows={4}
            value={comfortText}
            disabled={pending}
            aria-invalid={errors.comfort_needs ? true : undefined}
            aria-describedby={
              errors.comfort_needs ? `${formId}-comfort-error` : `${formId}-comfort-hint`
            }
            onChange={(event) => setComfortText(event.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
          />
          {errors.comfort_needs ? (
            <p id={`${formId}-comfort-error`} className="text-sm text-accent-profile-text">
              {errors.comfort_needs}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="text-base text-accent-profile-text">
            {formError}
          </p>
        ) : null}
        {pending ? (
          <p role="status" className="text-base text-muted">
            {CREATING_OUTFIT_MESSAGE}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!generateEnabled}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          Generate outfit
        </button>
      </form>

      {result ? <OutfitResult outfit={result} event={event} /> : null}
    </div>
  );
}

function OutfitResult({ outfit, event }: { outfit: EmergencyOutfitView; event: EventFitContext | null }) {
  return (
    <section aria-labelledby="emergency-result-title" className="flex min-w-0 flex-col gap-5">
      <div className="flex max-w-2xl flex-col gap-2">
        <h2
          id="emergency-result-title"
          className="font-display text-3xl font-semibold tracking-tight text-foreground break-words"
        >
          {outfit.title}
        </h2>
        <p className="text-base text-foreground">{outfit.explanation}</p>
      </div>
      {outfit.limitations ? (
        <p
          role="status"
          className="max-w-2xl rounded-md border border-primary bg-surface px-4 py-4 text-base font-semibold text-foreground"
        >
          {outfit.limitations}
        </p>
      ) : null}
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
        {outfit.items.map((item, index) => (
          <li
            key={`${item.name}-${item.category}-${index}`}
            className="flex min-w-0 flex-col gap-3 border-t-[3px] border-primary bg-surface px-4 py-4"
          >
            <h3 className="font-display text-xl font-semibold text-foreground break-words">{item.name}</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Category</dt>
                <dd className="text-foreground">{categoryLabel(item.category)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Color</dt>
                <dd className="text-foreground">{item.color}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Notes</dt>
                <dd className="text-foreground break-words">{item.notes}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {outfit.styling_tips.length > 0 ? (
        <div className="flex max-w-2xl flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Styling tips</h3>
          <ul className="list-disc pl-5 text-base text-foreground">
            {outfit.styling_tips.map((tip, index) => (
              <li key={`${index}-${tip}`}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm text-muted">{AI_SUGGESTION_NOTE}</p>
      <SaveLookForm
        key={`${outfit.itemIds.join("|")}::${outfit.title}`}
        itemIds={outfit.itemIds}
        defaultName={outfit.title}
        defaultOccasion={outfit.title}
        attachEvent={event}
      />
    </section>
  );
}
