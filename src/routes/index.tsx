import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, LogOut, Flame, Lightbulb, Sparkles, X, Bell, Trophy, Settings, ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet, TrendingDown, TrendingUp, BarChart3, RefreshCw } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  getMonthlySummary,
  financialHealth,
  getStreak,
  getSmartTips,
  getNotifications,
  getLevel,
  getMonthlyHistory,
  type FinanceState,
} from "@/lib/finance-store";
import { formatBRL, formatCompactBRL, greetingFor, initialsOf } from "@/lib/format";
import { useAuth, signOut } from "@/hooks/use-auth";
import { AiInsights } from "@/components/ai-insights";
import { FinanceIntelligence } from "@/components/finance-intelligence";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finlux — Seu painel financeiro" },
      { name: "description", content: "Veja saldo, receitas, despesas e saúde financeira em segundos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const state = useFinance();
  const { profile, user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : state.userName);
  const summary = getMonthlySummary(state);
  const health = financialHealth(summary);
  const hidden = state.hideBalance;
  const mask = "R$ ••••••";
  const maxCat = summary.byCategory[0]?.total ?? 0;
  const streak = now ? getStreak(state, now) : 0;
  const tips = getSmartTips(state);
  const showOnboarding = now !== null && !state.onboardingDone;
  const notifs = getNotifications(state);
  const level = getLevel(state);
  const [notifOpen, setNotifOpen] = useState(false);
  const prefs = state.dashboardPrefs;
  const userReady = now !== null && !loading;
  const hasFinanceData = state.transactions.length > 0;

  return (
    <AppShell>
      {/* Greeting */}
      <header className="flex items-start justify-between px-6 pt-10 relative animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="min-w-0">
          {userReady ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {greetingFor(now)},
              </p>
              <h1 className="mt-1 text-3xl font-bold leading-tight text-foreground truncate animate-in fade-in duration-300">
                {displayName}
              </h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-card-elevated px-2.5 py-1 text-[11px] font-semibold text-muted-foreground capitalize">
                  {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-card-elevated px-2.5 py-1 text-xs font-bold text-foreground">
                    <Flame className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                    {streak} {streak === 1 ? "dia" : "dias"}
                  </span>
                )}
                {state.cloudLoading && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-card-elevated px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Sincronizando
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="animate-pulse">
              <div className="h-3 w-24 rounded-full bg-card-elevated" />
              <div className="mt-2 h-8 w-40 rounded-lg bg-card-elevated" />
              <div className="mt-3 h-6 w-28 rounded-full bg-card-elevated" />
            </div>
          )}
        </div>
        <div className="relative flex items-center gap-1.5 shrink-0">
          <Link
            to="/mais"
            aria-label="Ajustes"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            aria-label="Notificações"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground"
          >
            <Bell className="h-5 w-5" />
            {notifs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--color-destructive)] text-[10px] font-bold text-white flex items-center justify-center px-1">
                {notifs.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-card border border-border shadow-xl overflow-hidden z-30">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notificações</p>
                {notifs.length > 0 && (
                  <button
                    onClick={() => notifs.forEach((n) => financeActions.dismissNotification(n.id))}
                    className="text-[11px] font-semibold text-primary"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifs.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nada por aqui. Tudo certo!
                  </p>
                )}
                {notifs.map((n) => (
                  <div key={n.id} className="px-4 py-3 flex gap-3">
                    <span className="text-xl">{n.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <button
                      onClick={() => financeActions.dismissNotification(n.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Dispensar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            aria-label="Perfil"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-primary"
          >
            {initialsOf(displayName)}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-card border border-border shadow-xl overflow-hidden z-30">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-card-elevated"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Level */}
      <section className="px-6 mt-5">
        <Link
          to="/conquistas"
          className="flex items-center gap-3 rounded-3xl bg-card border border-border p-4 hover:border-primary transition-colors"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card-elevated text-[var(--color-warning)]">
            <Trophy className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                Nível {level.level} · {level.title}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {level.xp}/{level.nextXp} XP
              </p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, (level.xp / level.nextXp) * 100)}%` }}
              />
            </div>
          </div>
        </Link>
      </section>

      {/* Balance card */}
      <section className="px-6 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="rounded-3xl bg-gradient-to-br from-card to-card-elevated p-5 border border-border shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Saldo da conta</span>
            <button
              aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
              onClick={() => financeActions.toggleHideBalance()}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2 text-[2.4rem] font-bold tracking-tight text-foreground tabular-nums">
            {hidden ? mask : formatBRL(summary.balance)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.savings >= 0 ? "+" : ""}
            {hidden ? "R$ ••••" : formatBRL(summary.savings)} este mês
          </p>

          {summary.committed > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-card p-3 border border-border">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CreditCardIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Comprometido (cartão)</span>
                </div>
                <p className="mt-1 text-base font-bold tabular-nums text-[var(--color-warning)]">
                  {hidden ? "R$ ••••" : formatBRL(summary.committed)}
                </p>
              </div>
              <div className="rounded-2xl bg-card p-3 border border-border">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Saldo livre</span>
                </div>
                <p
                  className="mt-1 text-base font-bold tabular-nums"
                  style={{
                    color: summary.free >= 0 ? "var(--color-success)" : "var(--color-destructive)",
                  }}
                >
                  {hidden ? "R$ ••••" : formatBRL(summary.free)}
                </p>
              </div>
            </div>
          )}
          {summary.committed > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
              Compras no cartão só saem do saldo quando a fatura é paga.
            </p>
          )}
        </div>

        {/* 6 financial cards */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <FinCard icon={ArrowDownLeft} label="Receitas" value={summary.income} tone="success" hidden={hidden} />
          <FinCard icon={ArrowUpRight} label="Despesas" value={summary.expense} tone="danger" hidden={hidden} />
          <FinCard icon={TrendingUp} label="Recebido" value={summary.income} tone="success" hidden={hidden} />
          <FinCard icon={TrendingDown} label="Pago" value={summary.expense} tone="danger" hidden={hidden} />
          <FinCard icon={PiggyBank} label="Economia" value={summary.savings} tone="accent" hidden={hidden} />
          <FinCard icon={Wallet} label="Saldo livre" value={summary.free} tone="accent" hidden={hidden} />
        </div>
      </section>


      {/* Inteligência financeira (IA) */}
      <FinanceIntelligence state={state} hidden={hidden} />

      {/* Evolução mensal */}
      <EvolutionSection state={state} hidden={hidden} />

      {/* AI insights */}
      {prefs.showTips && <AiInsights state={state} />}







      {/* Health */}
      {prefs.showHealth && (
      <section className="px-6 mt-5">
        {hasFinanceData ? (
          <div className="rounded-3xl bg-card p-5 border border-border flex items-center gap-4">
            <HealthRing score={health.score} tone={health.tone} />
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground leading-tight">
                Saúde<br/>financeira
              </p>
              <p
                className="mt-1 text-lg font-bold"
                style={{
                  color:
                    health.tone === "ok"
                      ? "var(--color-success)"
                      : health.tone === "warn"
                      ? "var(--color-warning)"
                      : "var(--color-destructive)",
                }}
              >
                {health.label}
              </p>
            </div>
            <p className="text-right text-sm text-muted-foreground max-w-[7.5rem] leading-snug">
              {health.tone === "ok"
                ? "Você está economizando bem!"
                : health.tone === "warn"
                ? "Reduza um pouco os gastos."
                : "Atenção, gastos altos."}
            </p>
          </div>
        ) : (
          <div className="rounded-3xl bg-card p-5 border border-border flex flex-col items-center text-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-primary">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Sua análise começa aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adicione sua primeira receita ou despesa para começarmos sua análise financeira.
              </p>
            </div>
            <Link
              to="/nova"
              className="mt-1 inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform"
            >
              Adicionar primeira transação
            </Link>
          </div>
        )}
      </section>
      )}

      {/* Smart tips */}
      {prefs.showTips && tips.length > 0 && (
        <section className="px-6 mt-5">
          <div className="rounded-3xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Insights para você
              </h2>
            </div>
            <ul className="space-y-2.5">
              {tips.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Categories */}
      {prefs.showCategories && (
      <section className="px-6 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Gastos por categoria
          </h2>
          <Link to="/extrato" className="text-sm font-semibold text-primary">
            Ver tudo
          </Link>
        </div>
        <div className="rounded-3xl bg-card p-5 border border-border space-y-4">
          {summary.byCategory.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sem despesas neste mês.
            </p>
          )}
          {summary.byCategory.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.byCategory.slice(0, 6)}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={40}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {summary.byCategory.slice(0, 6).map((c) => (
                        <Cell key={c.category} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n) => [hidden ? "•••" : formatCompactBRL(v), n]}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Total
                  </span>
                  <span className="text-sm font-bold text-foreground tabular-nums leading-tight">
                    {hidden ? "•••" : formatCompactBRL(summary.expense)}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {summary.byCategory.slice(0, 6).map((c) => {
                  const pct = summary.expense > 0 ? Math.round((c.total / summary.expense) * 100) : 0;
                  return (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-foreground truncate flex-1">{c.category}</span>
                      <span className="text-muted-foreground font-semibold tabular-nums shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {summary.byCategory.slice(0, 4).map((c) => {
            const pct = maxCat > 0 ? Math.round((c.total / maxCat) * 100) : 0;
            return (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm text-foreground">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-sm text-muted-foreground">
                      {hidden ? "R$ ••••" : formatCompactBRL(c.total)}
                    </span>
                    <span className="text-sm font-bold text-foreground w-10 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* Recents */}
      {prefs.showRecents && (
      <section className="px-6 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Recentes
          </h2>
          <Link to="/extrato" className="text-sm font-semibold text-primary">
            Ver tudo
          </Link>
        </div>
        <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
          {state.transactions.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-9 w-9 rounded-full flex items-center justify-center text-base"
                  style={{ backgroundColor: "color-mix(in oklab, var(--color-muted) 80%, transparent)" }}
                >
                  {t.kind === "receita" ? "↑" : "↓"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.category}</p>
                </div>
              </div>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: t.kind === "receita" ? "var(--color-success)" : "var(--color-destructive)" }}
              >
                {t.kind === "receita" ? "+" : "-"}{hidden ? "•••" : formatBRL(t.amount)}
              </span>
            </div>
          ))}
          {state.transactions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação ainda.</p>
          )}
        </div>
      </section>
      )}

      {showOnboarding && <OnboardingModal name={displayName} />}
    </AppShell>
  );
}

function EvolutionSection({ state, hidden }: { state: FinanceState; hidden: boolean }) {
  const data = getMonthlyHistory(state, 6);
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) return null;
  return (
    <section className="px-6 mt-5">
      <div className="rounded-3xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Evolução · 6 meses
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "color-mix(in oklab, var(--color-muted) 40%, transparent)" }}
              formatter={(v: number, name) => [hidden ? "•••" : formatBRL(v), name === "income" ? "Receitas" : "Despesas"]}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="income" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-success)" }} /> Receitas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-destructive)" }} /> Despesas
          </span>
        </div>
      </div>
    </section>
  );
}



function MiniStat({
  label,
  value,
  tone,
  hidden,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "accent";
  hidden: boolean;
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "danger"
      ? "var(--color-destructive)"
      : "var(--color-primary)";
  return (
    <div className="rounded-2xl bg-card-elevated p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="mt-1.5 text-base font-bold tabular-nums leading-tight" style={{ color }}>
        {hidden ? "R$ •••" : (value >= 0 ? "+ " : "- ") + formatCompactBRL(Math.abs(value)).replace("R$ ", "R$ ")}
      </p>
    </div>
  );
}

function FinCard({
  icon: Icon,
  label,
  value,
  tone,
  hidden,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "success" | "danger" | "accent";
  hidden: boolean;
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "danger"
      ? "var(--color-destructive)"
      : "var(--color-primary)";
  return (
    <div className="rounded-2xl bg-card border border-border p-3.5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        <span
          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-base font-bold tabular-nums leading-tight" style={{ color }}>
        {hidden ? "R$ •••" : formatCompactBRL(Math.abs(value))}
      </p>
    </div>
  );
}


function HealthRing({ score, tone }: { score: number; tone: "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok" ? "var(--color-success)" : tone === "warn" ? "var(--color-warning)" : "var(--color-destructive)";
  const deg = Math.round((score / 100) * 360);
  return (
    <div
      className="relative h-16 w-16 rounded-full flex items-center justify-center"
      style={{
        background: `conic-gradient(${color} ${deg}deg, color-mix(in oklab, var(--color-muted) 80%, transparent) ${deg}deg)`,
      }}
    >
      <div className="h-12 w-12 rounded-full bg-card flex items-center justify-center">
        <span className="text-sm font-bold text-foreground tabular-nums">{score}%</span>
      </div>
    </div>
  );
}

function OnboardingModal({ name }: { name: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => {
    financeActions.completeOnboarding();
    setOpen(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 relative">
        <button
          onClick={close}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-4xl mb-3">👋</div>
        <h2 className="text-xl font-bold text-foreground">Bem-vindo(a), {name}!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Em 3 passos você assume o controle das suas finanças:
        </p>
        <ol className="mt-4 space-y-2.5 text-sm text-foreground">
          <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Registre uma receita ou despesa</li>
          <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Crie uma meta financeira</li>
          <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Acompanhe sua saúde financeira aqui</li>
        </ol>
        <Link
          to="/nova"
          onClick={close}
          className="mt-5 block w-full rounded-2xl bg-primary text-primary-foreground py-3 text-center font-bold"
        >
          Registrar primeira transação
        </Link>
        <button
          onClick={close}
          className="mt-2 w-full rounded-2xl bg-card-elevated py-3 text-sm font-semibold text-foreground"
        >
          Explorar primeiro
        </button>
      </div>
    </div>
  );
}