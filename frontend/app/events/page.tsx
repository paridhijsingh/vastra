import { EventsPanel } from "@/components/EventsPanel";
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
      <div className="flex max-w-2xl min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Events</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          Dates you want to dress for
        </h1>
      </div>
      <EventsPanel key={user.id} userId={user.id} showDeleted={deleted === "1"} />
    </div>
  );
}
