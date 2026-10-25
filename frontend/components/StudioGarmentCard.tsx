import { categoryLabel } from "@/lib/emergency/form";

type Props = {
  name: string;
  category: string;
  color: string;
  notes: string;
  kicker?: string;
  kickerClassName?: string;
};

export function StudioGarmentCard({
  name,
  category,
  color,
  notes,
  kicker,
  kickerClassName = "text-accent-wardrobe-text",
}: Props) {
  return (
    <article className="studio-garment">
      {kicker ? (
        <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${kickerClassName}`}>
          {kicker}
        </p>
      ) : null}
      <h3 className="font-display text-xl font-semibold leading-snug text-foreground break-words">{name}</h3>
      <dl className="grid gap-2 text-sm">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Category</dt>
          <dd className="text-foreground">{categoryLabel(category)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Color</dt>
          <dd className="text-foreground">{color}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Notes</dt>
          <dd className="break-words text-foreground">{notes.trim() ? notes : "None"}</dd>
        </div>
      </dl>
    </article>
  );
}
