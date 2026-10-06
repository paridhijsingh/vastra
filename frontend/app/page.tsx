import Link from "next/link";

const COMING_SOON = [
  {
    title: "Emergency Fit",
    description:
      "Get an outfit recommendation for an occasion and time limit using clothes you already own and have marked available.",
  },
  {
    title: "Rescue My Outfit",
    description:
      "Replace one piece that is not working while keeping the rest of the outfit locked in place.",
  },
  {
    title: "Style Dictionary",
    description:
      "Look up fashion terms, pairing guidance, occasions, and comfort-aware alternatives from curated entries.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex max-w-2xl flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Personal AI stylist
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          Style the clothes you already own.
        </h1>
        <p className="text-lg text-muted sm:text-xl">
          Vastra helps you dress for everyday occasions, celebrations, and
          festivities using your preferences and saved wardrobe—across Indian,
          Western, fusion, and other styles, for every gender.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/profile"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Style Profile
          </Link>
          <Link
            href="/wardrobe"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Wardrobe
          </Link>
        </div>
      </section>

      <section aria-labelledby="coming-soon-heading" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2
            id="coming-soon-heading"
            className="font-display text-2xl font-semibold text-foreground sm:text-3xl"
          >
            Coming soon
          </h2>
          <p className="max-w-2xl text-base text-muted">
            These workflows are planned. They are not available in this frontend
            shell yet.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-3">
          {COMING_SOON.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col gap-3 border-t-[3px] border-border pt-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <span className="shrink-0 rounded-sm bg-black/5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Coming soon
                </span>
              </div>
              <p className="text-base text-muted">{feature.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
