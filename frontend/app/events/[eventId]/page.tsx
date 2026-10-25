import Link from "next/link";

import { EventDetail } from "@/components/EventDetail";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventPage({ params }: PageProps) {
  const { eventId } = await params;
  const user = await requireUser(`/events/${eventId}`);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Events" title="Event details" kickerClassName="text-accent-wardrobe-text">
        <Link href="/events" className="text-sm font-semibold text-primary underline">
          Back to Events
        </Link>
      </WorkspaceHeader>
      <EventDetail key={user.id} userId={user.id} eventId={eventId} />
    </div>
  );
}
