import { StylistPanel } from "@/components/StylistPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function StylistPage() {
  const user = await requireUser("/stylist");

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <WorkspaceHeader kicker="Stylist" title="Your personal stylist">
        <p className="text-base text-muted">
          Ask for Indian, Western, fusion, or cultural outfits from your saved profile and wardrobe.
          This conversation stays in this tab and is not saved.
        </p>
      </WorkspaceHeader>
      <StylistPanel key={user.id} userId={user.id} />
    </div>
  );
}
