"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { WardrobeCard } from "@/components/WardrobeCard";
import {
  recentlyAdded,
  visibleWardrobeItems,
  wardrobeCountLabel,
  type WardrobeSort,
} from "@/lib/wardrobe/display";
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WardrobeSort>("added");
  const [items, setItems] = useState<WardrobeItemPublic[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [original, setOriginal] = useState<WardrobeItemPublic | null>(null);
  const [form, setForm] = useState<WardrobeItemCreate>({ ...EMPTY_ITEM_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
        const queryString =
          activeFilter === "all"
            ? ""
            : `?availability=${encodeURIComponent(activeFilter)}`;
        const response = await fetch(`/api/wardrobe${queryString}`, {
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
    setQuery("");
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
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
  }

  function scrollToForm() {
    resetForm();
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
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
  const visible = useMemo(
    () => visibleWardrobeItems(items, query, sort),
    [items, query, sort],
  );
  const featured = useMemo(
    () => (query.trim() ? [] : recentlyAdded(items)),
    [items, query],
  );
  const emptyWardrobe = loadState === "ready" && filter === "all" && items.length === 0;
  const emptyFilter =
    loadState === "ready" && filter !== "all" && items.length === 0;
  const emptySearch =
    loadState === "ready" && items.length > 0 && visible.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-8">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {loadState === "ready" ? wardrobeCountLabel(items.length, visible.length, query) : " "}
        </p>
        <button
          type="button"
          onClick={scrollToForm}
          className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
        >
          Add item
        </button>
      </div>

      {success ? (
        <p className="status-card text-sm" role="status">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="error-alert text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p className="status-card text-base text-muted" role="status">
          Loading wardrobe…
        </p>
      ) : null}

      {featured.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="wardrobe-featured-heading">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-wardrobe-text">
              Recently added
            </p>
            <h2 id="wardrobe-featured-heading" className="font-display text-2xl font-semibold text-foreground">
              Latest pieces
            </h2>
            <p className="text-sm text-muted">
              The newest garments in this list, in the order they were saved. They also appear in the collection below.
            </p>
          </div>
          <ul className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {featured.map((item) => (
              <li key={`featured-${item.id}`}>
                <WardrobeCard
                  item={item}
                  busy={busy}
                  deleting={deletingId === item.id}
                  onEdit={startEdit}
                  onDelete={(entry) => void onDelete(entry)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="wardrobe-collection-heading">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 id="wardrobe-collection-heading" className="font-display text-2xl font-semibold text-foreground">
            Collection
          </h2>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label htmlFor="wardrobe-search" className="text-sm font-semibold text-foreground">
                Search
              </label>
              <input
                id="wardrobe-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, color, notes…"
                className="min-h-12 w-full max-w-md rounded-md border border-border bg-surface px-3 text-base text-foreground"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="wardrobe-sort" className="text-sm font-semibold text-foreground">
                Sort
              </label>
              <select
                id="wardrobe-sort"
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value === "name" ? "name" : "added")
                }
                className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
              >
                <option value="added">As added</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
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

        {emptyWardrobe ? (
          <div className="status-card flex flex-col gap-3" role="status">
            <p className="text-base text-muted">
              Your wardrobe is empty. Your style profile stores your preferences;
              add your clothing and accessories here.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="btn-primary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
            >
              Add your first item
            </button>
          </div>
        ) : null}

        {emptyFilter ? (
          <p className="status-card text-base text-muted" role="status">
            No items match this filter. Try “All” or another availability status.
          </p>
        ) : null}

        {emptySearch ? (
          <p className="status-card text-base text-muted" role="status">
            No pieces match this search. Try a different name, color, or note.
          </p>
        ) : null}

        {visible.length > 0 ? (
          <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
            {visible.map((item) => (
              <li key={item.id}>
                <WardrobeCard
                  item={item}
                  busy={busy}
                  deleting={deletingId === item.id}
                  onEdit={startEdit}
                  onDelete={(entry) => void onDelete(entry)}
                />
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
          {editingId && original ? (
            <p className="text-sm text-muted">Editing {original.name}.</p>
          ) : (
            <p className="text-sm text-muted">
              Multiple items can share a category or name. Each item is stored separately.
            </p>
          )}
        </div>

        <form
          ref={formRef}
          id="wardrobe-item-form"
          className="flex scroll-mb-24 flex-col gap-4"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="item-name" className="text-sm font-semibold text-foreground">
              Name
            </label>
            <input
              ref={nameInputRef}
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
              className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
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
                className="btn-secondary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold"
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
