import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  generateMonthlyReport,
  colorForCategory,
} from "@/lib/finance-store";
import { formatBRL, monthLabel } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, PieChart as PieIcon, BarChart3, LineChart as LineIcon } from "lucide-react";

export const Route = createFileRoute("/relatorio")({
  head: () => ({ meta: [{ title: "Relatório — Finlux" }] }),
  component: Relatorio;
});

type ChartTab = "pizza" | "barra" | "linha";

function Relatorio() {
  const state = useFinance();
  const [tab, setTab] = useState<ChartTab>("pizza");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 380);
    return () => clearTimeout(t);
  }, []);

  const ref = new Date();
  const r = useMemo(() => generateMonthlyReport(state, ref), [state]);

  // Series for last 6 months
  const monthly = useMemo(() => {
    const out: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const txs = state.transactions.filter((t) => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y;
      });
      const income = txs.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
      const expense = txs.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
      out.push({
        key: `${y}-${m}`,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        income,
        expense,
      });
    }
    return out;
  }, [state.transactions]);

  return (
    <AppShell>
      <PageHeader subtitle={capitalize(monthLabel(ref))} title="Relatório" />

      <div className="px-6 space-y-4 pb-6">
        {/* Top stats */}
        <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <Stat label="Receitas" value={r.income} tone="success" icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <Stat label="Despesas" value={r.expense} tone="danger" icon={<TrendingDown className="h-3.5 w-3.5" />} />
          <Stat label="Economia" value={r.savings} tone="accent" />
        </div>

        {/* Chart switcher */}
        <div className="flex gap-2 animate-in fade-in duration-300">
          {([
            { v: "pizza", label: "Pizza", icon: PieIcon },
            { v: "barra", label: "Barras", icon: BarChart3 },
            { v: "linha", label: "Linha", icon: LineIcon },
          ] as { v: ChartTab; label: string; icon: typeof PieIcon }[]).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold transition-colors ${
                tab === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Chart card */}
        <section className="rounded-3xl bg-card border border-border p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
          {loading ? (
            <Skeleton className="h-56 w-full rounded-2xl" />
          ) : tab === "pizza" ? (
            <PieChart data={r.byCategory} />
          ) : tab === "barra" ? (
            <BarChart data={monthly} />
          ) : (
            <LineChart data={monthly} />
          )}
        </section>

        {/* Categories list */}
        <section className="rounded-3xl bg-card border border-border p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Por categoria
          </h2>
          {r.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas este mês.</p>
          ) : (
            <ul className="space-y-2.5">
              {r.byCategory.map((c) => {
                const pct = r.expense > 0 ? (c.total / r.expense) * 100 : 0;
                return (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.category}
                        <span className="text-muted-foreground text-xs">{pct.toFixed(0)}%</span>
                      </span>
                      <span className="tabular-nums font-bold text-foreground">{formatBRL(c.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${pct}%`, backgroundColor: c.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Insights */}
        <section className="rounded-3xl bg-card border border-border p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Insights
          </h2>
          <ul className="space-y-2 text-sm text-foreground">
            {r.insights.length === 0 && <li className="text-muted-foreground">Sem insights ainda.</li>}
            {r.insights.map((i, idx) => (
              <li key={idx} className="rounded-2xl bg-card-elevated px-4 py-3">
                {i}
              </li>
            ))}
          </ul>
        </section>

        {/* Goals */}
        {r.goalsProgress.length > 0 && (
          <section className="rounded-3xl bg-card border border-border p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
              Metas
            </h2>
            <ul className="space-y-3">
              {r.goalsProgress.map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">{g.title}</span>
                    <span className="font-bold text-foreground">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-500"
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "accent";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "danger"
      ? "var(--color-destructive)"
      : "var(--color-primary)";
  return (
    <div className="rounded-2xl bg-card border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums" style={{ color }}>
        {formatBRL(value)}
      </p>
    </div>
  );
}

/* ===== Charts (pure SVG, no deps) ===== */

function PieChart({ data }: { data: { category: string; total: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.total, 0);
  if (total === 0) {
    return <EmptyChart label="Sem despesas no período" />;
  }
  const size = 200;
  const r = 80;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 28;
  let acc = 0;
  const C = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={stroke} />
        {data.map((d) => {
          const frac = d.total / total;
          const dash = frac * C;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={d.category}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          );
        })}
        <g transform={`rotate(90 ${cx} ${cy})`}>
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            Total
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-foreground font-bold"
            style={{ fontSize: 16 }}
          >
            {formatBRL(total)}
          </text>
        </g>
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.slice(0, 6).map((d) => (
          <span
            key={d.category}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.category}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const H = 180;
  const barW = 12;
  const gap = 4;
  const groupW = barW * 2 + gap;
  const colGap = 16;
  const W = data.length * (groupW + colGap) - colGap;

  if (max <= 1) return <EmptyChart label="Sem dados nos últimos meses" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-success)" }} />
          Receitas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: "var(--color-destructive)" }} />
          Despesas
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg width={W} height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
          {data.map((d, i) => {
            const x = i * (groupW + colGap);
            const ih = (d.income / max) * H;
            const eh = (d.expense / max) * H;
            return (
              <g key={d.label}>
                <rect
                  x={x}
                  y={H - ih}
                  width={barW}
                  height={ih}
                  rx={3}
                  fill="var(--color-success)"
                  className="transition-all duration-500"
                />
                <rect
                  x={x + barW + gap}
                  y={H - eh}
                  width={barW}
                  height={eh}
                  rx={3}
                  fill="var(--color-destructive)"
                  className="transition-all duration-500"
                />
                <text
                  x={x + groupW / 2}
                  y={H + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10 }}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function LineChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const W = 320;
  const H = 180;
  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  if (max <= 1) return <EmptyChart label="Sem dados nos últimos meses" />;

  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const pt = (val: number, i: number) => {
    const x = pad.l + i * step;
    const y = pad.t + innerH - (val / max) * innerH;
    return [x, y] as const;
  };
  const pathFor = (key: "income" | "expense") =>
    data
      .map((d, i) => {
        const [x, y] = pt(d[key], i);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const areaFor = (key: "income" | "expense") => {
    const first = pt(data[0][key], 0);
    const last = pt(data[data.length - 1][key], data.length - 1);
    return `M ${first[0]} ${pad.t + innerH} ${data
      .map((d, i) => {
        const [x, y] = pt(d[key], i);
        return `L ${x} ${y}`;
      })
      .join(" ")} L ${last[0]} ${pad.t + innerH} Z`;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ backgroundColor: "var(--color-success)" }} />
          Receitas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ backgroundColor: "var(--color-destructive)" }} />
          Despesas
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="gIncome" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gExpense" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + innerH * p}
            y2={pad.t + innerH * p}
            stroke="var(--color-border)"
            strokeDasharray="2 4"
          />
        ))}
        <path d={areaFor("income")} fill="url(#gIncome)" />
        <path d={areaFor("expense")} fill="url(#gExpense)" />
        <path d={pathFor("income")} fill="none" stroke="var(--color-success)" strokeWidth={2} strokeLinejoin="round" />
        <path
          d={pathFor("expense")}
          fill="none"
          stroke="var(--color-destructive)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const [ix, iy] = pt(d.income, i);
          const [ex, ey] = pt(d.expense, i);
          return (
            <g key={d.label}>
              <circle cx={ix} cy={iy} r={3} fill="var(--color-success)" />
              <circle cx={ex} cy={ey} r={3} fill="var(--color-destructive)" />
              <text
                x={pad.l + i * step}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
