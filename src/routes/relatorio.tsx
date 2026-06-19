import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, generateMonthlyReport } from "@/lib/finance-store";
import { formatBRL, monthLabel } from "@/lib/format";

export const Route = createFileRoute("/relatorio")({
  head: () => ({ meta: [{ title: "Relatório mensal — Finlux" }] }),
  component: Relatorio,
});

function Relatorio() {
  const state = useFinance();
  const r = generateMonthlyReport(state);

  return (
    <AppShell>
      <PageHeader subtitle="Relatório do mês" title={capitalize(monthLabel(r.ref))} />
      <div className="px-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Receitas" value={r.income} tone="success" />
          <Stat label="Despesas" value={r.expense} tone="danger" />
          <Stat label="Economia" value={r.savings} tone="accent" />
        </div>

        <section className="rounded-3xl bg-card border border-border p-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Por categoria
          </h2>
          {r.byCategory.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas este mês.</p>}
          <ul className="space-y-2">
            {r.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.category}
                </span>
                <span className="tabular-nums font-bold">{formatBRL(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-card border border-border p-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Metas
          </h2>
          {r.goalsProgress.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta.</p>}
          <ul className="space-y-3">
            {r.goalsProgress.map((g) => (
              <li key={g.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{g.title}</span>
                  <span className="font-bold">{g.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${g.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-card border border-border p-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Insights
          </h2>
          <ul className="space-y-2 text-sm text-foreground">
            {r.insights.length === 0 && <li className="text-muted-foreground">Sem insights ainda.</li>}
            {r.insights.map((i, idx) => (
              <li key={idx} className="rounded-2xl bg-card-elevated px-4 py-3">{i}</li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" | "accent" }) {
  const color =
    tone === "success" ? "var(--color-success)" : tone === "danger" ? "var(--color-destructive)" : "var(--color-primary)";
  return (
    <div className="rounded-2xl bg-card border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums" style={{ color }}>
        {formatBRL(value)}
      </p>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}