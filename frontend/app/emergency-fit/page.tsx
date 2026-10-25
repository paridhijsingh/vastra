import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { EmergencyFitPanel } from "@/components/EmergencyFitPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/require-user";
import { emergencyFitEventPath } from "@/lib/emergency/event-fit";
import { prepareEmergencyFit } from "@/lib/emergency/event-fit-server";
import { EMERGENCY_FIT_EXPLANATION } from "@/lib/emergency/form";

export const dynamic = "force-dynamic";

export default async function EmergencyFitPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const params = await searchParams;
  const eventId = typeof params.event === "string" ? params.event.trim() : "";
  const returnPath = eventId ? emergencyFitEventPath(eventId) : "/emergency-fit";
  const user = await requireUser(returnPath);
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    redirect(`/signin?next=${encodeURIComponent(returnPath)}`);
  }
  const loaded = await prepareEmergencyFit(token, params.event);
  if (loaded.status === "unauthorized") {
    redirect(`/signin?next=${encodeURIComponent(returnPath)}`);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Emergency Fit" title="What can you wear?">
        <p id="emergency-fit-purpose" className="text-base text-muted">
          {EMERGENCY_FIT_EXPLANATION}
        </p>
      </WorkspaceHeader>
      {loaded.status === "not_found" ? (
        <div className="status-card flex max-w-2xl flex-col gap-3" role="status">
          <p>That saved event could not be found.</p>
          <Link href="/events" className="font-semibold text-primary underline">
            Back to Events
          </Link>
        </div>
      ) : loaded.status === "unavailable" ? (
        <p role="alert" className="error-alert text-base">
          Could not load this saved event.
        </p>
      ) : (
        <EmergencyFitPanel
          key={user.id}
          userId={user.id}
          returnPath={returnPath}
          event={loaded.status === "ready" ? loaded.event : null}
        />
      )}
    </div>
  );
}
