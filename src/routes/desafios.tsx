import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, getChallenges } from "@/lib/finance-store";

export const Route = createFileRoute("/desafios")({
  head: () => finluxMeta('Desafios — Finlux', 'Acompanhe desafios e objetivos financeiros do mês.'),
  component: Desafios,
});

function Desafios() {
  const state = useFinance();
  const challenges = getChallenges(state);
  return (
    <AppShell>
      <PageHeader subtitle="Gamificação" title="Desafios do mês" />
      <div className="px-6 space-y-3">
        {challenges.map((c) => (
          <div
            key={c.id}
            className={`rounded-3xl border p-5 ${
              c.done ? "border-[var(--color-success)] bg-card-elevated" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">{c.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-foreground">{c.title}</p>
                  {c.done && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-success)]">
                      Concluído
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(3, c.progress)}%`,
                      backgroundColor: c.done ? "var(--color-success)" : "var(--color-primary)",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                  <span className="text-muted-foreground">{c.current}</span>
                  <span className="font-semibold text-foreground">{c.target}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
