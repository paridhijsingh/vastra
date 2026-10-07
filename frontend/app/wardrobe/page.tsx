export default function WardrobePage() {
  return (
    <div className="flex max-w-2xl min-w-0 flex-col gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-wardrobe-text">
        Wardrobe
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
        Clothes you already own
      </h1>
      <p className="text-lg text-muted">
        Manually add, view, edit, and delete clothing and accessories, and mark
        items available, in the laundry, or packed away. This page will connect
        to your private wardrobe next.
      </p>
      <p className="rounded-md border border-border bg-surface px-4 py-4 text-base font-medium text-foreground">
        API connection coming next.
      </p>
    </div>
  );
}
