import { useOnline } from "@/shared/hooks/useOnline";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center gap-2 bg-warning/90 px-4 py-2 text-sm text-foreground shadow">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline. Your cart is saved — an internet connection is needed to confirm your booking.</span>
    </div>
  );
}