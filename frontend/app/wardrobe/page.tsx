import { WardrobePanel } from "@/components/WardrobePanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const user = await requireUser("/wardrobe");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspaceHeader kicker="Wardrobe" title="Clothes you already own" kickerClassName="text-accent-wardrobe-text">
        <p className="text-base text-muted">
          Add, edit, and delete clothing and accessories, and mark items available, in the laundry, or packed away.
          Your wardrobe is private to your account.
        </p>
      </WorkspaceHeader>
      <WardrobePanel key={user.id} userId={user.id} />
    </div>
  );
}
