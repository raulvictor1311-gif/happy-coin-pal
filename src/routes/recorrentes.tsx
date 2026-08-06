import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Plus, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/app-shell";
import { LuxBubble } from "@/components/lux/lux-bubble";
import { useFinance, financeActions, type FinanceState } from "@/lib/finance-store";
import { detectRecurring, type RecurringItem } from "@/lib/finance-ai";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/recorrentes")({
  head: () => ({
    meta: [
      { title: "Contas recorrentes — Finlux" },
      {
        name: "description",
        content:
          "Veja assinaturas e contas que repetem todo mês, o dia habitual de cobrança e o total comprometido.",
      },
      { property: "og:title", content: "Contas recorrentes — Finlux" },
      {
        property: "og:description",
        content: "O Lux identifica o que repete todo mês e avisa antes de vencer.",
      },
    ],
  }),
  component: Recorrentes,
});

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Dia habitual de cobrança (mediana dos dias registrados). */
function typicalDay(state: FinanceState, description: string): number | null {
  const key = norm(description);
  const days = state.transactions
    .filter((t) => norm(t.description || t.category) === key)
    .map((t) => new Date(t.date).getDate())
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  return days[Math.floor(days.length / 2)] ?? null;
}

function paidThisMonth(state: FinanceState, description: string, ref: Date): boolean {
  const key = norm(description);
  return state.transactions.some((t) => {
    const d = new Date(t.date);
    return (
      norm(t.description || t.category) === key &&
      d.getMonth() === ref.getMonth() &&
      d.getFullYear() === ref.getFullYear()
    );
  });
}

interface RecurringRow extends RecurringItem {
  day: number | null;
  paid: boolean;
  daysAway: number | null;
}

function Recorrentes() {
  const state = useFinance();
  const [ref] = useState(() => new Date());

  const rows = useMemo<RecurringRow[]>(() => {
    return detectRecurring(state, ref).map((item) => {
      const day = typicalDay(state, item.description);
      return {
        ...item,
        day,
        paid: paidThisMonth(state, item.description, ref),
        daysAway: day === null ? null : day - ref.getDate(),
      };
    });
  }, [state, ref]);

  const expenses = rows.filter((r) => r.kind === "despesa");
  const incomes = rows.filter((r) => r.kind === "receita");
  const monthlyExpense = expenses.reduce((a, r) => a + r.avgAmount, 0);
  const monthlyIncome = incomes.reduce((a, r) => a + r.avgAmount, 0);
  const pending = expenses.filter((r) => !r.paid);

  function register(row: RecurringRow) {
    financeActions.addTransaction({
      kind: row.kind,
      amount: Math.round(row.avgAmount * 100) / 100,
      category: row.category,
      description: row.description,
      date: new Date().toISOString(),
      paymentMethod: "dinheiro",
    });
    toast.success(`${row.description} registrado como ${formatBRL(row.avgAmount)}.`);
  }

  return (
    <AppShell>
      <PageHeader title="Contas recorrentes" subtitle="Repetem todo mês" />

      <section className="px-6">
        <LuxBubble emotion={pending.length > 0 ? "planejando" : "feliz"}>
          {rows.length === 0
            ? "Ainda não encontrei padrões mensais. Depois de dois meses de registros eu começo a reconhecer suas assinaturas e contas fixas."
            : pending.length > 0
              ? `Encontrei ${rows.length} lançamento${rows.length > 1 ? "s" : ""} que repete${rows.length > 1 ? "m" : ""} todo mês. ${pending.length} ainda não apareceu neste mês.`
              : "Tudo que costuma repetir já foi registrado neste mês. Organização impecável!"}
        </LuxBubble>
      </section>

      {rows.length > 0 && (
        <section className="px-6 mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-card border border-border p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-[var(--color-destructive)]" />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">
                Fixo por mês
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-foreground">{formatBRL(monthlyExpense)}</p>
            <p className="text-[11px] text-muted-foreground">
              {expenses.length} conta{expenses.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-3xl bg-card border border-border p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-success)]" />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">
                Renda fixa
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-foreground">{formatBRL(monthlyIncome)}</p>
            <p className="text-[11px] text-muted-foreground">
              {incomes.length} entrada{incomes.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <section className="px-6 mt-6">
          <div className="rounded-3xl border border-dashed border-border p-6 text-center">
            <Repeat className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Registre suas contas fixas por dois meses e elas aparecem aqui automaticamente.
            </p>
            <Link
              to="/nova"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" />
              Novo lançamento
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-6 mt-5 space-y-3 pb-4">
          {rows.map((row) => (
            <article
              key={`${row.kind}-${row.description}`}
              className="rounded-3xl bg-card border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-foreground">{row.description}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {row.category} · visto em {row.monthsSeen} meses
                  </p>
                </div>
                <p
                  className="text-sm font-bold shrink-0"
                  style={{
                    color:
                      row.kind === "despesa"
                        ? "var(--color-destructive)"
                        : "var(--color-success)",
                  }}
                >
                  {row.kind === "despesa" ? "-" : "+"}
                  {formatBRL(row.avgAmount)}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-card-elevated px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {row.day === null
                    ? "Dia variável"
                    : row.paid
                      ? `Dia ${row.day} · já lançado`
                      : row.daysAway !== null && row.daysAway < 0
                        ? `Dia ${row.day} · atrasado`
                        : row.daysAway === 0
                          ? "Vence hoje"
                          : `Vence em ${row.daysAway} dia${row.daysAway === 1 ? "" : "s"}`}
                </span>
                {row.paid ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-success)]">
                    <CheckCircle2 className="h-4 w-4" />
                    Em dia
                  </span>
                ) : (
                  <button
                    onClick={() => register(row)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[11px] font-bold text-primary-foreground active:scale-95 transition-transform"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Lançar agora
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
