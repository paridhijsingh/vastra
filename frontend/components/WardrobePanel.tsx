"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUSES,
  CATEGORY_LABELS,
  EMPTY_ITEM_FORM,
  ITEM_CATEGORIES,
  diffWardrobeUpdate,
  type AvailabilityStatus,
  type ItemCategory,
  type WardrobeItemCreate,
  type WardrobeItemPublic,
} from "@/lib/wardrobe/types";

type FilterValue = "all" | AvailabilityStatus;
type LoadState = "loading" | "ready" | "error";

type Props = {
  userId: string;
};

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "in_laundry", label: "In laundry" },
  { value: "packed_away", label: "Packed away" },
];

export function WardrobePanel({ userId }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [items, setItems] = useState<WardrobeItemPublic[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [original, setOriginal] = useState<WardrobeItemPublic | null>(null);
  const [form, setForm] = useState<WardrobeItemCreate>({ ...EMPTY_ITEM_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setOriginal(null);
    setForm({ ...EMPTY_ITEM_FORM });
  }, []);

  const loadItems = useCallback(
    async (activeFilter: FilterValue) => {
      setLoadState("loading");
      setError(null);
      try {
        const query =
          activeFilter === "all"
            ? ""
            : `?availability=${encodeURIComponent(activeFilter)}`;
        const response = await fetch(`/api/wardrobe${query}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as {
          items?: WardrobeItemPublic[];
          error?: string;
        };

        if (response.status === 401) {
          setError(body.error ?? "Your session has expired. Please sign in again.");
          setLoadState("error");
          router.push("/signin?next=/wardrobe");
          router.refresh();
          return;
        }

        if (!response.ok) {
          setError(
            body.error ??
              (response.status === 503
                ? "The wardrobe service is unavailable. Please try again later."
                : "Could not load your wardrobe. Please try again."),
          );
          setLoadState("error");
          return;
        }

        setItems(body.items ?? []);
        setLoadState("ready");
      } catch {
        setError("The wardrobe service is unavailable. Please try again later.");
        setLoadState("error");
      }
    },
    [router],
  );

  useEffect(() => {
    resetForm();
    setSuccess(null);
    setError(null);
    void loadItems(filter);
  }, [userId, filter, loadItems, resetForm]);

  function startEdit(item: WardrobeItemPublic) {
    setEditingId(item.id);
    setOriginal(item);
    setForm({
      name: item.name,
      category: item.category,
      color: item.color,
      notes: item.notes,
      availability: item.availability,
    });
    setSuccess(null);
    setError(null);
  }

  function updateField<K extends keyof WardrobeItemCreate>(
    key: K,
    value: WardrobeItemCreate[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || deletingId) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    const payload: WardrobeItemCreate = {
      name: form.name.trim(),
      category: form.category,
      color: form.color.trim(),
      notes: form.notes.trim(),
      availability: form.availability,
    };

    try {
      let response: Response;
      if (editingId && original) {
        const patch = diffWardrobeUpdate(original, payload);
        if (Object.keys(patch).length === 0) {
          setSuccess("No changes to save.");
          setSaving(false);
          return;
        }
        response = await fetch(`/api/wardrobe/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(patch),
        });
      } else {
        response = await fetch("/api/wardrobe", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
      }

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        item?: WardrobeItemPublic;
      };

      if (response.status === 401) {
        setError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/wardrobe");
        router.refresh();
        return;
      }

      if (!response.ok) {
        // Preserve unsaved form input.
        setError(
          body.error ??
            (response.status === 503
              ? "The wardrobe service is unavailable. Please try again later."
              : response.status === 404
                ? "That wardrobe item was not found."
                : "Could not save the item. Please try again."),
        );
        return;
      }

      setSuccess(editingId ? "Item updated." : "Item added.");
      resetForm();
      await loadItems(filter);
      router.refresh();
    } catch {
      setError("The wardrobe service is unavailable. Please try again later.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: WardrobeItemPublic) {
    if (saving || deletingId) return;
    const confirmed = window.confirm(
      `Delete “${item.name}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    setDeletingId(item.id);

    try {
      const response = await fetch(
        `/api/wardrobe/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (response.status === 401) {
        setError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/wardrobe");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(
          body.error ??
            (response.status === 404
              ? "That wardrobe item was not found."
              : "Could not delete the item. Please try again."),
        );
        return;
      }

      if (editingId === item.id) {
        resetForm();
      }
      setSuccess("Item deleted.");
      await loadItems(filter);
      router.refresh();
    } catch {
      setError("The wardrobe service is unavailable. Please try again later.");
    } finally {
      setDeletingId(null);
    }
  }

  const busy = saving || Boolean(deletingId);
  const emptyWardrobe = loadState === "ready" && filter === "all" && items.length === 0;
  const emptyFilter =
    loadState === "ready" && filter !== "all" && items.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="wardrobe-filter-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2
            id="wardrobe-filter-heading"
            className="font-display text-2xl font-semibold text-foreground"
          >
            Your items
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by availability"
          >
            {FILTERS.map((option) => {
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={active}
                  className={[
                    "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-semibold transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:bg-black/5",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {success ? (
          <p
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground"
            role="status"
          >
            {success}
          </p>
        ) : null}

        {error ? (
          <p
            className="rounded-md border border-[#b94732]/40 bg-[#b94732]/10 px-4 py-3 text-sm text-accent-profile-text"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loadState === "loading" ? (
          <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
            Loading wardrobe…
          </p>
        ) : null}

        {emptyWardrobe ? (
          <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
            Your wardrobe is empty. Add your first item below.
          </p>
        ) : null}

        {emptyFilter ? (
          <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
            No items match this filter. Try “All” or another availability status.
          </p>
        ) : null}

        {items.length > 0 ? (
          <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 flex-col gap-3 border-t-[3px] border-[var(--accent-wardrobe)] bg-surface px-4 py-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-display text-xl font-semibold text-foreground break-words">
                    {item.name}
                  </h3>
                  <p className="text-xs font-medium tracking-wide text-muted">
                    ID: <span className="font-mono text-foreground">{item.id}</span>
                  </p>
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-muted">Category</dt>
                    <dd className="text-foreground">{CATEGORY_LABELS[item.category]}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-muted">Color</dt>
                    <dd className="text-foreground">{item.color}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-muted">Availability</dt>
                    <dd className="text-foreground">
                      {AVAILABILITY_LABELS[item.availability]}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="font-semibold text-muted">Notes</dt>
                    <dd className="text-foreground break-words">
                      {item.notes ? item.notes : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={busy}
                    className="btn-primary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold disabled:opacity-70"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(item)}
                    disabled={busy}
                    className="inline-flex min-h-11 items-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10 disabled:opacity-70"
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="flex max-w-2xl min-w-0 flex-col gap-4"
        aria-labelledby="wardrobe-form-heading"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="wardrobe-form-heading"
            className="font-display text-2xl font-semibold text-foreground"
          >
            {editingId ? "Edit item" : "Add item"}
          </h2>
          {editingId ? (
            <p className="text-sm text-muted">
              Editing item ID{" "}
              <span className="font-mono text-foreground">{editingId}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Multiple items can share a category or name. Each item has its own ID.
            </p>
          )}
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="item-name" className="text-sm font-semibold text-foreground">
              Name
            </label>
            <input
              id="item-name"
              name="name"
              type="text"
              required
              maxLength={128}
              value={form.name}
              disabled={busy}
              onChange={(event) => updateField("name", event.target.value)}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="item-category" className="text-sm font-semibold text-foreground">
              Category
            </label>
            <select
              id="item-category"
              name="category"
              value={form.category}
              disabled={busy}
              onChange={(event) =>
                updateField("category", event.target.value as ItemCategory)
              }
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            >
              {ITEM_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="item-color" className="text-sm font-semibold text-foreground">
              Color
            </label>
            <input
              id="item-color"
              name="color"
              type="text"
              required
              maxLength={64}
              value={form.color}
              disabled={busy}
              onChange={(event) => updateField("color", event.target.value)}
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="item-notes" className="text-sm font-semibold text-foreground">
              Notes <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="item-notes"
              name="notes"
              rows={3}
              maxLength={512}
              value={form.notes}
              disabled={busy}
              onChange={(event) => updateField("notes", event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="item-availability"
              className="text-sm font-semibold text-foreground"
            >
              Availability
            </label>
            <select
              id="item-availability"
              name="availability"
              value={form.availability}
              disabled={busy}
              onChange={(event) =>
                updateField(
                  "availability",
                  event.target.value as AvailabilityStatus,
                )
              }
              className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
            >
              {AVAILABILITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {AVAILABILITY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add item"}
            </button>
            {editingId ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  resetForm();
                  setSuccess(null);
                  setError(null);
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground hover:bg-black/5 disabled:opacity-70"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
