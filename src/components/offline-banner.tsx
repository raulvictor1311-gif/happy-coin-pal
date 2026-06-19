import { WifiOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useOnlineStatus } from "@/lib/network-status";
import { useSyncQueue } from "@/lib/sync-queue";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const queue = useSyncQueue();

  if (online && queue.length === 0) return null;

  return (
    <Link
      to="/offline"
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-border bg-card-elevated/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur"
    >
      <WifiOff className="h-3.5 w-3.5 text-destructive" />
      {online
        ? `Sincronizando ${queue.length} ${queue.length === 1 ? "item" : "itens"}…`
        : queue.length > 0
          ? `Sem conexão — ${queue.length} na fila`
          : "Sem conexão — usando dados offline"}
    </Link>
  );
}
