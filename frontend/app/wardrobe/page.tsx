import { WardrobePanel } from "@/components/WardrobePanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const user = await requireUser("/wardrobe");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspaceHeader kicker="Wardrobe" title="My Wardrobe" kickerClassName="text-accent-wardrobe-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.wardrobe}</p>
      </WorkspaceHeader>
      <WardrobePanel key={user.id} userId={user.id} />
    </div>
  );
}
