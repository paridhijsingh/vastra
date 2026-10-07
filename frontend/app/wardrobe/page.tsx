import { WardrobePanel } from "@/components/WardrobePanel";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const user = await requireUser("/wardrobe");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-2xl min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-wardrobe-text">
          Wardrobe
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl md:text-5xl">
          Clothes you already own
        </h1>
        <p className="text-lg text-muted">
          Add, edit, and delete clothing and accessories, and mark items
          available, in the laundry, or packed away. Your wardrobe is private to
          your account.
        </p>
      </div>
      <WardrobePanel key={user.id} userId={user.id} />
    </div>
  );
}
