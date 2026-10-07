import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireUser("/profile");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-profile-text">
          Style Profile
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          Your style preferences
        </h1>
        <p className="text-lg text-muted">
          Save preferred styles, colors, fit, comfort preferences, and clothing to
          avoid. Changes are stored for your signed-in account only.
        </p>
      </div>
      <ProfileForm />
    </div>
  );
}
