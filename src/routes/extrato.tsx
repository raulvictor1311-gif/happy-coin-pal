import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, financeActions, colorForCategory } from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/extrato")({
  head: () => ({ meta: [{ title: "Extrato — Finlux" }] }),
  component: Extrato,
});

type Filter = "todos" | "receita" | "despesa";

function Extrato() {
  const state = useFinance();
  const [filter, setFilter] = useState<Filter>("todos");
  const items = state.transactions.filter((t) => filter === "todos" || t.kind === filter);

  const grouped = items.reduce<Record<string, typeof items>>((acc, t) => {
    const d = new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    (acc[d] ||= []).push(t);
    return acc;
  }, {});

  return (
    <AppShell>
      <PageHeader subtitle="Movimentos" title="Extrato" />
      <div className="px-6 flex gap-2 mb-4">
        {(["todos", "receita", "despesa"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {f === "todos" ? "Todos" : f === "receita" ? "Receitas" : "Despesas"}
          </button>
        ))}
      </div>

      <div className="px-6 space-y-6">
        {Object.entries(grouped).map(([day, list]) => (
          <div key={day}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              {day}
            </p>
            <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-4">
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in oklab, ${colorForCategory(t.category)} 20%, transparent)` }}
                  >
                    <span style={{ color: colorForCategory(t.category) }} className="font-bold">
                      {t.kind === "receita" ? "↑" : "↓"}
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: t.kind === "receita" ? "var(--color-success)" : "var(--color-destructive)" }}
                  >
                    {t.kind === "receita" ? "+" : "-"}
                    {formatBRL(t.amount)}
                  </span>
                  <button
                    onClick={() => financeActions.removeTransaction(t.id)}
                    aria-label="Remover"
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhum movimento encontrado.</p>
        )}
      </div>
    </AppShell>
  );
}