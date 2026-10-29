"use client";

import { ItemTermHint } from "@/components/ItemTermHint";
import { categoryLabel } from "@/lib/emergency/form";

type Props = {
  name: string;
  category: string;
  color: string;
  notes: string;
  availability?: string;
  why?: string;
  kicker?: string;
  kickerClassName?: string;
};

export function StudioGarmentCard({
  name,
  category,
  color,
  notes,
  availability = "Available",
  why,
  kicker,
  kickerClassName = "text-accent-wardrobe-text",
}: Props) {
  const categoryText = categoryLabel(category);
  const whyLine = why?.trim() || notes.trim() || `${color} ${categoryText.toLowerCase()} from your wardrobe.`;
  return (
    <article className="studio-garment">
      {kicker ? (
        <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${kickerClassName}`}>
          {kicker}
        </p>
      ) : null}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <ItemTermHint name={name} />
        <p className="availability-badge" data-tone={availability.toLowerCase().includes("unknown") ? "unknown" : "available"}>
          {availability}
        </p>
      </div>
      <p className="text-sm font-semibold text-muted">{categoryText}</p>
      <p className="studio-garment-why">
        <span className="font-semibold text-foreground">Why this works. </span>
        {whyLine}
      </p>
    </article>
  );
}
