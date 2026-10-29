import { StylistPanel } from "@/components/StylistPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

export default async function StylistPage() {
  const user = await requireUser("/stylist");

  return (
    <div className="stylist-page">
      <WorkspaceHeader kicker="Stylist" title="Your personal stylist">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.stylist}</p>
      </WorkspaceHeader>
      <StylistPanel key={user.id} userId={user.id} />
    </div>
  );
}
