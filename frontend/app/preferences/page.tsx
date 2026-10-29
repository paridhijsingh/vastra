import { PreferencesPanel } from "@/components/PreferencesPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await requireUser("/preferences");

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Preferences" title="Saved guidance" kickerClassName="text-accent-profile-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.preferences}</p>
      </WorkspaceHeader>
      <PreferencesPanel key={user.id} userId={user.id} />
    </div>
  );
}
