import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-w-0 flex-col gap-12">
      <section className="flex max-w-2xl min-w-0 flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Personal AI stylist
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          Style the clothes you already own.
        </h1>
        <p className="text-lg text-muted sm:text-xl">
          Vastra helps you dress for everyday occasions, celebrations, and
          festivities using your preferences and saved wardrobe—across Indian,
          Western, fusion, and other styles, for every gender.
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/profile"
            className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Style Profile
          </Link>
          <Link
            href="/wardrobe"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Wardrobe
          </Link>
          <Link
            href="/emergency-fit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Emergency Fit
          </Link>
          <Link
            href="/rescue"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Rescue
          </Link>
          <Link
            href="/dictionary"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-border bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Style Dictionary
          </Link>
        </div>
      </section>
    </div>
  );
}
