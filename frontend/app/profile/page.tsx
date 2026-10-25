import { ProfileForm } from "@/components/ProfileForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8">
      <WorkspaceHeader kicker="Style Profile" title="Your style preferences" kickerClassName="text-accent-profile-text">
        <p className="text-base text-muted">
          Save preferred styles, colors, fit, comfort preferences, and clothing to avoid. Changes are stored for your signed-in account only.
        </p>
      </WorkspaceHeader>
      <ProfileForm key={user.id} />
    </div>
  );
}
