import { DictionaryBrowser } from "@/components/DictionaryBrowser";
import { requireUser } from "@/lib/auth/require-user";
import {
  dictionaryListHref,
  filtersFromSearchParams,
} from "@/lib/dictionary/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DictionaryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = filtersFromSearchParams(params);
  const user = await requireUser(dictionaryListHref(parsed.filters));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-dictionary-text">
          Style Dictionary
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          Explore fashion terms
        </h1>
        <p className="text-lg text-muted">
          Learn about Indian, Western, fusion, and cultural styles, including
          pairings, occasions, weather, and comfort.
        </p>
      </div>
      <DictionaryBrowser
        key={user.id}
        initialFilters={parsed.filters}
        unsupportedStyle={parsed.unsupportedStyle}
        unsupportedKind={parsed.unsupportedKind}
      />
    </div>
  );
}
