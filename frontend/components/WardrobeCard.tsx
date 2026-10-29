"use client";

import type { CSSProperties } from "react";

import { ItemTermHint } from "@/components/ItemTermHint";
import {
  AVAILABILITY_LABELS,
  CATEGORY_LABELS,
  type WardrobeItemPublic,
} from "@/lib/wardrobe/types";
import { colorWash } from "@/lib/wardrobe/display";

type Props = {
  item: WardrobeItemPublic;
  busy: boolean;
  deleting: boolean;
  onEdit: (item: WardrobeItemPublic) => void;
  onDelete: (item: WardrobeItemPublic) => void;
};

export function WardrobeCard({ item, busy, deleting, onEdit, onDelete }: Props) {
  const wash = colorWash(item.color);
  const stageStyle = wash
    ? ({ "--wardrobe-wash": wash } as CSSProperties)
    : undefined;

  return (
    <article className="wardrobe-card">
      <div
        className="wardrobe-stage"
        data-category={item.category}
        data-washed={wash ? "true" : undefined}
        style={stageStyle}
        aria-hidden="true"
      >
        <span className="wardrobe-hanger" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-wardrobe-text">
            {CATEGORY_LABELS[item.category]}
          </p>
          <ItemTermHint name={item.name} />
          <p className="text-sm text-muted">
            <span className="text-foreground">{item.color}</span>
            <span aria-hidden="true"> · </span>
            {AVAILABILITY_LABELS[item.availability]}
          </p>
          {item.notes ? (
            <p className="line-clamp-2 text-sm text-muted break-words">{item.notes}</p>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={busy}
            className="btn-secondary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10 disabled:opacity-70"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}
