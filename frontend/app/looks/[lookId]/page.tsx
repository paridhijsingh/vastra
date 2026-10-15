import { LookDetail } from "@/components/LookDetail";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ lookId: string }>;
};

export default async function LookPage({ params }: PageProps) {
  const { lookId } = await params;
  const user = await requireUser(`/looks/${lookId}`);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Saved Looks</p>
      <LookDetail key={user.id} userId={user.id} lookId={lookId} />
    </div>
  );
}
