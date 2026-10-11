import { DictionaryEntryView } from "@/components/DictionaryEntryView";
import { requireUser } from "@/lib/auth/require-user";

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
    <DictionaryEntryView
      key={user.id}
      entryId={entryId}
      showAddedNotice={added === "1"}
      startEditing={edit === "1"}
    />
  );
}
