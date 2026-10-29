import Link from "next/link";

import { DictionaryEntryView } from "@/components/DictionaryEntryView";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DictionaryEntryPage({ params, searchParams }: PageProps) {
  const { entryId } = await params;
  const query = await searchParams;
  const added = Array.isArray(query.added) ? query.added[0] : query.added;
  const edit = Array.isArray(query.edit) ? query.edit[0] : query.edit;
  const user = await requireUser(`/dictionary/${entryId}`);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Style Dictionary" title="Term details" kickerClassName="text-accent-dictionary-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.dictionary}</p>
        <Link href="/dictionary" className="text-sm font-semibold text-primary underline">
          Back to the dictionary
        </Link>
      </WorkspaceHeader>
      <DictionaryEntryView
        key={user.id}
        entryId={entryId}
        showAddedNotice={added === "1"}
        startEditing={edit === "1"}
      />
    </div>
  );
}
