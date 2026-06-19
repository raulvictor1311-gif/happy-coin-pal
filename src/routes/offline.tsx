import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { WifiOff, RefreshCw, RotateCw, Download, Wifi } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useOnlineStatus, checkOnline } from "@/lib/network-status";
import { useSyncQueue, flush } from "@/lib/sync-queue";
import { useFinance } from "@/lib/finance-store";
import { transactionsToCsv, downloadCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/offline")({
  head: () => ({ meta: [{ title: "Offline — Finlux" }] }),
  component: OfflinePage,
});

function OfflinePage() {
  const online = useOnlineStatus();
  const queue = useSyncQueue();
  const state = useFinance();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "ping" | "cache" | "sync">(null);

  async function tryReconnect() {
    setBusy("ping");
    const ok = await checkOnline();
    setBusy(null);
    if (ok) {
      await flush();
      navigate({ to: "/" });
    }
  }

  async function refreshCache() {
    setBusy("cache");
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => null)));
      }
    } finally {
      setBusy(null);
      window.location.reload();
    }
  }

  async function trySync() {
    setBusy("sync");
    await flush();
    setBusy(null);
  }

  function exportCsv() {
    const csv = transactionsToCsv(state.transactions);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`finlux-transacoes-${date}.csv`, csv);
  }

  return (
    <AppShell>
      <PageHeader subtitle="Conexão" title={online ? "Tudo certo" : "Sem conexão"} />

      <div className="px-6 space-y-5">
        <div className="rounded-3xl bg-card border border-border p-6 text-center">
          <span
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${
              online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {online ? <Wifi className="h-8 w-8" /> : <WifiOff className="h-8 w-8" />}
          </span>
          <h2 className="mt-4 font-bold text-foreground">
            {online ? "Conectado" : "Você está offline"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {online
              ? "Você pode continuar usando o app normalmente."
              : "O Finlux continua funcionando com seus dados salvos. Novas receitas e despesas vão para a fila e serão enviadas quando a conexão voltar."}
          </p>
          {queue.length > 0 && (
            <p className="mt-3 inline-flex rounded-full bg-card-elevated px-3 py-1 text-xs font-semibold text-foreground">
              {queue.length} {queue.length === 1 ? "item" : "itens"} na fila de sincronização
            </p>
          )}
        </div>

        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            O que fazer
          </h3>

          <button
            onClick={tryReconnect}
            disabled={busy !== null}
            className="w-full flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground p-4 font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${busy === "ping" ? "animate-spin" : ""}`} />
            Tentar reconectar
          </button>

          <button
            onClick={trySync}
            disabled={busy !== null || queue.length === 0}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-4 font-bold text-foreground disabled:opacity-50"
          >
            <RotateCw className={`h-5 w-5 text-primary ${busy === "sync" ? "animate-spin" : ""}`} />
            Sincronizar agora
            {queue.length > 0 && (
              <span className="ml-auto text-xs rounded-full bg-card-elevated px-2 py-0.5 text-muted-foreground">
                {queue.length}
              </span>
            )}
          </button>

          <button
            onClick={refreshCache}
            disabled={busy !== null}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-4 font-bold text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 text-primary ${busy === "cache" ? "animate-spin" : ""}`} />
            Atualizar cache do app
          </button>

          <button
            onClick={exportCsv}
            className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-4 font-bold text-foreground"
          >
            <Download className="h-5 w-5 text-primary" />
            Exportar transações (CSV)
          </button>
        </section>

        <section className="rounded-3xl bg-card border border-border p-5 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Dicas</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Verifique o Wi-Fi ou os dados móveis do dispositivo.</li>
            <li>Saia do modo avião, se estiver ativado.</li>
            <li>Atualizar o cache resolve telas em branco após uma nova versão.</li>
            <li>Seus dados ficam salvos no dispositivo — nada é perdido offline.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
