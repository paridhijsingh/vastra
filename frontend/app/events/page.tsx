import { EventsPanel } from "@/components/EventsPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: PageProps) {
  const user = await requireUser("/events");
  const query = await searchParams;
  const deleted = Array.isArray(query.deleted) ? query.deleted[0] : query.deleted;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspaceHeader kicker="Events" title="Dates you want to dress for" />
      <EventsPanel key={user.id} userId={user.id} showDeleted={deleted === "1"} />
    </div>
  );
}
