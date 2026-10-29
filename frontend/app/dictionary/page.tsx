import { DictionaryBrowser } from "@/components/DictionaryBrowser";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import {
  dictionaryListHref,
  filtersFromSearchParams,
} from "@/lib/dictionary/types";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DictionaryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = filtersFromSearchParams(params);
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const user = await requireUser(dictionaryListHref(parsed.filters));

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Style Dictionary" title="Explore fashion terms" kickerClassName="text-accent-dictionary-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.dictionary}</p>
      </WorkspaceHeader>
      <DictionaryBrowser
        key={user.id}
        initialFilters={parsed.filters}
        unsupportedStyle={parsed.unsupportedStyle}
        unsupportedKind={parsed.unsupportedKind}
        showDeletedNotice={notice === "deleted"}
      />
    </div>
  );
}
