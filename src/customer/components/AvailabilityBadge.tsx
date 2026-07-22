import { availabilityLabel, type AvailabilityTier } from "@/shared/lib/format";
import { CircleCheck, CircleAlert, CircleX, CircleMinus } from "lucide-react";

const styles: Record<AvailabilityTier, string> = {
  available: "bg-success/15 text-success",
  low: "bg-warning/20 text-foreground",
  almost: "bg-warning/30 text-foreground",
  sold_out: "bg-muted text-muted-foreground",
};
const icons: Record<AvailabilityTier, typeof CircleCheck> = {
  available: CircleCheck, low: CircleMinus, almost: CircleAlert, sold_out: CircleX,
};

export function AvailabilityBadge({ tier }: { tier: AvailabilityTier }) {
  const Icon = icons[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[tier]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{availabilityLabel(tier)}</span>
    </span>
  );
}