export default function ProfilePage() {
  return (
    <div className="flex max-w-2xl min-w-0 flex-col gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-profile-text">
        Style Profile
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
        Your style preferences
      </h1>
      <p className="text-lg text-muted">
        Save preferred styles, colors, fit, comfort preferences, and clothing to
        avoid. Support for men, women, and unisex styling—and Indian, Western,
        fusion, and other styles—is planned.
      </p>
      <p className="rounded-md border border-border bg-surface px-4 py-4 text-base font-medium text-foreground">
        API connection coming next.
      </p>
    </div>
  );
}
