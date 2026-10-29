import Link from "next/link";

import { SaveLookForm } from "@/components/SaveLookForm";
import type { EventFitContext } from "@/lib/emergency/event-fit";

type Props = {
  itemIds?: readonly string[] | null;
  defaultName: string;
  defaultOccasion: string;
  attachEvent?: EventFitContext | null;
  saveBlockedMessage?: string | null;
};

export function OutfitNextActions({
  itemIds,
  defaultName,
  defaultOccasion,
  attachEvent = null,
  saveBlockedMessage = null,
}: Props) {
  return (
    <div className="outfit-actions">
      {itemIds && itemIds.length > 0 ? (
        <SaveLookForm
          itemIds={itemIds}
          defaultName={defaultName}
          defaultOccasion={defaultOccasion}
          attachEvent={attachEvent}
        />
      ) : saveBlockedMessage ? (
        <p className="status-card text-sm text-muted" role="status">
          {saveBlockedMessage}
        </p>
      ) : null}
      <Link
        href="/rescue"
        className="btn-secondary inline-flex min-h-12 w-fit items-center justify-center rounded-md px-5 text-base font-semibold"
      >
        Rescue this outfit
      </Link>
    </div>
  );
}
