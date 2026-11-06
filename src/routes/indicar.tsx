import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance } from "@/lib/finance-store";
import { Copy, Check, Gift } from "lucide-react";

export const Route = createFileRoute("/indicar")({
  head: () => finluxMeta('Indicar amigos — Finlux', 'Compartilhe o Finlux com seus amigos.'),
  component: Indicar,
});

function Indicar() {
  const state = useFinance();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <AppShell>
      <PageHeader subtitle="Programa de indicação" title="Indique e ganhe" />
      <div className="px-6 space-y-4">
        <div className="rounded-3xl bg-card border border-border p-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-card-elevated flex items-center justify-center mb-3">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Convide um amigo, ganhe uma conquista</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para cada amigo que se cadastrar com seu código e registrar a primeira transação,
            vocês dois ganham um bônus exclusivo.
          </p>
          <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl bg-card-elevated px-4 py-3">
            <span className="font-mono text-base font-bold text-foreground tracking-wider">
              {state.referralCode}
            </span>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-sm font-bold"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <div className="rounded-3xl bg-card border border-border p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
            Como funciona
          </p>
          <ol className="space-y-2 text-sm text-foreground">
            <li>1. Compartilhe seu código com amigos.</li>
            <li>2. O amigo se cadastra usando o código.</li>
            <li>3. Quando ele registrar a primeira transação, vocês dois desbloqueiam um bônus exclusivo.</li>
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
