import { EventsPanel } from "@/components/EventsPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: PageProps) {
  const user = await requireUser("/events");
  const query = await searchParams;
  const deleted = Array.isArray(query.deleted) ? query.deleted[0] : query.deleted;

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Events" title="Dates you want to dress for" kickerClassName="text-accent-wardrobe-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.events}</p>
      </WorkspaceHeader>
      <EventsPanel key={user.id} userId={user.id} showDeleted={deleted === "1"} />
    </div>
  );
}
