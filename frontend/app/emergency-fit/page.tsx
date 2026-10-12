import { EmergencyFitPanel } from "@/components/EmergencyFitPanel";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function EmergencyFitPage() {
  const user = await requireUser("/emergency-fit");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Emergency Fit
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          What can you wear?
        </h1>
      </div>
      <EmergencyFitPanel key={user.id} userId={user.id} />
    </div>
  );
}
