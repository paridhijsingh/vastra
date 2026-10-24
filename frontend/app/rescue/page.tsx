import { RescuePanel } from "@/components/RescuePanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function RescuePage() {
  const user = await requireUser("/rescue");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspaceHeader kicker="Rescue My Outfit" title="Change one piece" />
      <RescuePanel key={user.id} userId={user.id} />
    </div>
  );
}
