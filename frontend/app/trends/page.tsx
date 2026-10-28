import { TrendStylistPanel } from "@/components/TrendStylistPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { TREND_PAGE_EXPLANATION } from "@/lib/trends/form";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const user = await requireUser("/trends");

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Trend Stylist" title="What is being worn right now?">
        <p id="trend-stylist-purpose" className="text-base text-muted">
          {TREND_PAGE_EXPLANATION}
        </p>
      </WorkspaceHeader>
      <TrendStylistPanel key={user.id} userId={user.id} />
    </div>
  );
}
