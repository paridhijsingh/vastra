import { PreferencesPanel } from "@/components/PreferencesPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await requireUser("/preferences");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspaceHeader kicker="Preferences" title="Saved guidance" kickerClassName="text-accent-profile-text">
        <p className="text-base text-muted">
          Review a preference before it is saved. Later outfit requests can use it as guidance. It does not decide which clothes you own or whether they are available.
        </p>
      </WorkspaceHeader>
      <PreferencesPanel key={user.id} userId={user.id} />
    </div>
  );
}
