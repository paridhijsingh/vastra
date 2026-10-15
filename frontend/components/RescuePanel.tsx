"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { SaveLookForm } from "@/components/SaveLookForm";
import {
  AI_SUGGESTION_NOTE,
  CHANGE_REQUEST_MAX,
  EMPTY_WARDROBE_MESSAGE,
  FINDING_REPLACEMENT_MESSAGE,
  ITEMS_CHANGED_MESSAGE,
  NO_CANDIDATE_MESSAGE,
  RESCUE_EXPLANATION,
  SAME_CATEGORY_NOTE,
  WARDROBE_LOAD_ERROR,
  availableItemsFromApi,
  canSubmitRescue,
  categoryLabel,
  chooseReplacement,
  keepingIds,
  replacementCandidateCount,
  rescueDecision,
  rescueViewFromApi,
  syncSelectionToWardrobe,
  toggleOutfitItem,
  wardrobeGate,
  type AvailableItem,
  type RescueFieldErrors,
  type RescueFormState,
  type RescueView,
} from "@/lib/rescue/form";

type Props = {
  userId: string;
};

const EMPTY_FORM: RescueFormState = {
  selectedIds: [],
  replaceItemId: null,
  occasion: "",
  changeRequest: "",
  comfortText: "",
  result: null,
};

export function RescuePanel({ userId }: Props) {
  const router = useRouter();
  const formId = useId();
  const pendingRef = useRef(false);
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [form, setForm] = useState<RescueFormState>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [wardrobeLoading, setWardrobeLoading] = useState(true);
  const [wardrobeFailed, setWardrobeFailed] = useState(false);
  const [errors, setErrors] = useState<RescueFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadOffer, setReloadOffer] = useState(false);

  const loadWardrobe = useCallback(async () => {
    setWardrobeLoading(true);
    setWardrobeFailed(false);
    try {
      const response = await fetch("/api/wardrobe?availability=available", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/signin?next=/rescue");
        return;
      }
      if (!response.ok) {
        setWardrobeFailed(true);
        setItems([]);
        return;
      }
      const body: unknown = await response.json();
      const parsed = availableItemsFromApi(
        body && typeof body === "object" && "items" in body ? (body as { items: unknown }).items : null,
      );
      if (!parsed) {
        setWardrobeFailed(true);
        setItems([]);
        return;
      }
      setItems(parsed);
      setForm((current) => syncSelectionToWardrobe(current, parsed));
      setWardrobeFailed(false);
    } catch {
      setWardrobeFailed(true);
      setItems([]);
    } finally {
      setWardrobeLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWardrobe();
  }, [loadWardrobe, userId]);

  const gate = wardrobeGate({
    loading: wardrobeLoading,
    failed: wardrobeFailed,
    availableCount: items.length,
  });
  const candidateCount = replacementCandidateCount(items, form.selectedIds, form.replaceItemId);
  const submitEnabled = canSubmitRescue({
    gate,
    pending,
    replaceItemId: form.replaceItemId,
    candidateCount,
  });
  const kept = new Set(keepingIds(form.selectedIds, form.replaceItemId));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = rescueDecision({
      pending: pendingRef.current,
      items,
      selectedIds: form.selectedIds,
      replaceItemId: form.replaceItemId,
      occasion: form.occasion,
      changeRequest: form.changeRequest,
      comfortText: form.comfortText,
    });
    if (decision.status === "blocked") return;
    if (decision.status === "invalid") {
      setErrors(decision.errors);
      return;
    }
    if (!submitEnabled) return;

    pendingRef.current = true;
    setPending(true);
    setErrors({});
    setFormError(null);
    setReloadOffer(false);
    setForm((current) => ({ ...current, result: null }));
    try {
      const response = await fetch("/api/outfits/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision.body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/signin?next=/rescue");
        return;
      }
      if (!response.ok) {
        const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        setErrors(
          record.fields && typeof record.fields === "object" ? (record.fields as RescueFieldErrors) : {},
        );
        setFormError(
          typeof record.error === "string" && record.error.trim() ? record.error : ITEMS_CHANGED_MESSAGE,
        );
        setReloadOffer(response.status === 404 || response.status === 409);
        return;
      }
      const names = Object.fromEntries(items.map((item) => [item.id, item.name]));
      const view = rescueViewFromApi(
        payload && typeof payload === "object" && "outfit" in payload
          ? (payload as { outfit: unknown }).outfit
          : null,
        names,
      );
      if (!view) {
        setFormError("The outfit suggestion could not be used. Please try again.");
        return;
      }
      setForm((current) => ({ ...current, result: view }));
    } catch {
      setFormError("Outfit suggestions are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 max-w-2xl flex-col gap-5">
        <p className="text-base text-muted">{RESCUE_EXPLANATION}</p>
        <p className="text-base text-muted">{SAME_CATEGORY_NOTE}</p>

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
                void loadWardrobe();
              }}
              className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
            >
              Try again
            </button>
          </div>
        ) : null}
        {gate.status === "empty" ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4" role="status">
            <p>{EMPTY_WARDROBE_MESSAGE}</p>
            <Link
              href="/wardrobe"
              className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
            >
              Go to Wardrobe
            </Link>
          </div>
        ) : null}

        {gate.status === "ready" ? (
          <fieldset className="flex flex-col gap-3" disabled={pending}>
            <legend className="text-sm font-semibold text-foreground">Current outfit</legend>
            <p id={`${formId}-outfit-hint`} className="text-sm text-muted">
              Select the pieces you are wearing. Choose one of them to replace.
            </p>
            <ul className="flex flex-col gap-3" aria-describedby={`${formId}-outfit-hint`}>
              {items.map((item) => {
                const checked = form.selectedIds.includes(item.id);
                const replaceChecked = form.replaceItemId === item.id;
                return (
                  <li key={item.id} className="rounded-md border border-border bg-surface px-4 py-3">
                    <label className="flex min-h-11 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          setForm((current) => toggleOutfitItem(current, item.id));
                          setErrors({});
                        }}
                      />
                      <span className="text-base text-foreground">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-muted">
                          {" "}
                          · {item.color} · {categoryLabel(item.category)}
                        </span>
                      </span>
                    </label>
                    {checked ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 pl-7">
                        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                          <input
                            type="radio"
                            name={`${formId}-replace`}
                            checked={replaceChecked}
                            onChange={() => {
                              setForm((current) => chooseReplacement(current, item.id));
                              setErrors({});
                            }}
                          />
                          Replace
                        </label>
                        {form.replaceItemId && kept.has(item.id) ? (
                          <span className="text-sm text-muted">Keeping</span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {errors.item_ids ? <p className="text-sm text-accent-profile-text">{errors.item_ids}</p> : null}
            {errors.replace_item_id ? (
              <p className="text-sm text-accent-profile-text">{errors.replace_item_id}</p>
            ) : null}
          </fieldset>
        ) : null}

        {form.replaceItemId && candidateCount === 0 && gate.status === "ready" ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-4 py-4" role="status">
            <p>{NO_CANDIDATE_MESSAGE}</p>
            <Link
              href="/wardrobe"
              className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
            >
              Go to Wardrobe
            </Link>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-occasion`} className="text-sm font-semibold">
            Occasion
          </label>
          <input
            id={`${formId}-occasion`}
            required
            maxLength={200}
            value={form.occasion}
            disabled={pending}
            aria-invalid={errors.occasion ? true : undefined}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, occasion: value, result: null }));
            }}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base"
          />
          {errors.occasion ? <p className="text-sm text-accent-profile-text">{errors.occasion}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-change`} className="text-sm font-semibold">
            What would you like to change?
          </label>
          <textarea
            id={`${formId}-change`}
            required
            maxLength={CHANGE_REQUEST_MAX}
            rows={3}
            value={form.changeRequest}
            disabled={pending}
            aria-invalid={errors.change_request ? true : undefined}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, changeRequest: value, result: null }));
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-base"
          />
          {errors.change_request ? (
            <p className="text-sm text-accent-profile-text">{errors.change_request}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-comfort`} className="text-sm font-semibold">
            Comfort needs
          </label>
          <p id={`${formId}-comfort-hint`} className="text-sm text-muted">
            Optional. Enter one comfort need per line.
          </p>
          <textarea
            id={`${formId}-comfort`}
            rows={3}
            value={form.comfortText}
            disabled={pending}
            aria-describedby={`${formId}-comfort-hint`}
            aria-invalid={errors.comfort_needs ? true : undefined}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, comfortText: value, result: null }));
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-base"
          />
          {errors.comfort_needs ? (
            <p className="text-sm text-accent-profile-text">{errors.comfort_needs}</p>
          ) : null}
        </div>

        {formError ? (
          <div className="flex flex-col gap-3" role="alert">
            <p className="text-base text-accent-profile-text">{formError}</p>
            {reloadOffer ? (
              <button
                type="button"
                onClick={() => {
                  setReloadOffer(false);
                  void loadWardrobe();
                }}
                className="inline-flex min-h-12 w-fit items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold"
              >
                Reload wardrobe
              </button>
            ) : null}
          </div>
        ) : null}
        {pending ? (
          <p role="status" className="text-base text-muted">
            {FINDING_REPLACEMENT_MESSAGE}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!submitEnabled}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          Rescue my outfit
        </button>
      </form>
      {form.result ? <RescueResult outfit={form.result} /> : null}
    </div>
  );
}

function RescueResult({ outfit }: { outfit: RescueView }) {
  return (
    <section aria-labelledby="rescue-result-title" className="flex min-w-0 flex-col gap-5">
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 id="rescue-result-title" className="font-display text-3xl font-semibold tracking-tight break-words">
          {outfit.title}
        </h2>
        <p className="text-base font-semibold text-foreground">{outfit.headline}</p>
        <p className="text-base text-foreground">{outfit.explanation}</p>
      </div>
      {outfit.limitations ? (
        <p
          role="status"
          className="max-w-2xl rounded-md border border-primary bg-surface px-4 py-4 text-base font-semibold"
        >
          {outfit.limitations}
        </p>
      ) : null}
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
        {outfit.cards.map((card, index) => (
          <li
            key={`${card.role}-${card.name}-${index}`}
            className="flex min-w-0 flex-col gap-3 border-t-[3px] border-primary bg-surface px-4 py-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{card.role}</p>
            <h3 className="font-display text-xl font-semibold break-words">{card.name}</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Category</dt>
                <dd>{categoryLabel(card.category)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Color</dt>
                <dd>{card.color}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">Notes</dt>
                <dd className="break-words">{card.notes}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{AI_SUGGESTION_NOTE}</p>
      <SaveLookForm
        key={`${outfit.itemIds.join("|")}::${outfit.title}`}
        itemIds={outfit.itemIds}
        defaultName={outfit.title}
        defaultOccasion={outfit.title}
      />
    </section>
  );
}
