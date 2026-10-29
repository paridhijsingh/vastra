import Link from "next/link";

import { LookDetail } from "@/components/LookDetail";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ lookId: string }>;
};

export default async function LookPage({ params }: PageProps) {
  const { lookId } = await params;
  const user = await requireUser(`/looks/${lookId}`);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Saved Looks" title="Look details" kickerClassName="text-accent-wardrobe-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.looks}</p>
        <Link href="/looks" className="text-sm font-semibold text-primary underline">
          Back to Saved Looks
        </Link>
      </WorkspaceHeader>
      <LookDetail key={user.id} userId={user.id} lookId={lookId} />
    </div>
  );
}
