import { Link } from "@tanstack/react-router";
import { Brain, ShieldCheck, TrendingDown, CalendarClock, ArrowRight } from "lucide-react";
import {
  financialScore,
  stabilityIndex,
  balanceForecast,
  safeDailySpend,
  emergencyReserve,
  detectWaste,
} from "@/lib/finance-ai";
import { type FinanceState } from "@/lib/finance-store";
import { formatBRL, formatCompactBRL } from "@/lib/format";

function toneColor(tone: "ok" | "warn" | "bad"): string {
  return tone === "ok"
    ? "var(--color-success)"
    : tone === "warn"
      ? "var(--color-warning)"
      : "var(--color-destructive)";
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground tabular-nums leading-none">{score}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function FinanceIntelligence({ state, hidden }: { state: FinanceState; hidden: boolean }) {
  if (state.transactions.length === 0) return null;

  const score = financialScore(state);
  const stability = stabilityIndex(state);
  const forecast = balanceForecast(state);
  const daily = safeDailySpend(state);
  const reserve = emergencyReserve(state);
  const waste = detectWaste(state);
  const topWaste = waste[0];

  const scoreColor = toneColor(score.tone);
  const money = (v: number) => (hidden ? "R$ ••••" : formatBRL(v));

  return (
    <section className="px-6 mt-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="rounded-3xl card-premium p-5">
        <div className="absolute" aria-hidden />

        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Inteligência financeira
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <ScoreRing score={score.score} color={scoreColor} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: scoreColor }}>
              Score {score.label}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                Estabilidade: <span className="font-semibold text-foreground">{stability.label}</span>
                {stability.index > 0 ? ` (${stability.index}/100)` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-card p-3 border border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Saldo previsto (fim do mês)</span>
            </div>
            <p
              className="mt-1 text-base font-bold tabular-nums"
              style={{ color: forecast.projectedBalance >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}
            >
              {money(forecast.projectedBalance)}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-3 border border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="truncate">Gasto diário seguro</span>
            </div>
            <p className="mt-1 text-base font-bold text-foreground tabular-nums">
              {hidden ? "R$ ••••" : formatCompactBRL(daily)}
              <span className="text-xs font-medium text-muted-foreground">/dia</span>
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-3 border border-border">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Reserva de emergência</span>
            <span className="tabular-nums">{reserve.coverageMonths.toFixed(1)} de 6 meses</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${reserve.pct}%`,
                backgroundColor: reserve.pct >= 60 ? "var(--color-success)" : reserve.pct >= 25 ? "var(--color-warning)" : "var(--color-destructive)",
              }}
            />
          </div>
        </div>

        {topWaste && (
          <div className="mt-3 flex gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--color-warning)_12%,transparent)] p-3">
            <TrendingDown className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
            <p className="text-xs text-foreground leading-snug">{topWaste.detail}</p>
          </div>
        )}

        <Link
          to="/assistente"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold py-2.5 text-sm active:scale-[0.98] transition-transform"
        >
          Falar com o Assessor <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
