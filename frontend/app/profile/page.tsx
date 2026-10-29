import { ProfileForm } from "@/components/ProfileForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";
import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Style Profile" title="Your style preferences" kickerClassName="text-accent-profile-text">
        <p className="text-base text-muted">{PAGE_DESCRIPTIONS.profile}</p>
      </WorkspaceHeader>
      <ProfileForm key={user.id} />
    </div>
  );
}
