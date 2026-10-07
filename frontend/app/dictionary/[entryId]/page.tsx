import { DictionaryEntryView } from "@/components/DictionaryEntryView";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ entryId: string }>;
};

export default async function DictionaryEntryPage({ params }: PageProps) {
  const { entryId } = await params;
  await requireUser(`/dictionary/${entryId}`);

  return <DictionaryEntryView entryId={entryId} />;
}
