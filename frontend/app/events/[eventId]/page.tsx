import { EventDetail } from "@/components/EventDetail";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventPage({ params }: PageProps) {
  const { eventId } = await params;
  const user = await requireUser(`/events/${eventId}`);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Events</p>
      <EventDetail key={user.id} userId={user.id} eventId={eventId} />
    </div>
  );
}
