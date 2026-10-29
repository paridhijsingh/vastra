import { styledByBadge, type NemotronTier } from "@/lib/ai";

export function ModelBadge({ tier }: { tier: NemotronTier }) {
  return <p className="model-badge">{styledByBadge(tier)}</p>;
}
