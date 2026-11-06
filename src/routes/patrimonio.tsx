import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  netWorth,
  ASSET_LABELS,
  futureInstallmentsTotal,
  type AssetType,
} from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/patrimonio")({
  head: () => finluxMeta('Patrimônio — Finlux', 'Consulte bens, investimentos, dívidas e patrimônio líquido.'),
  component: Patrimonio,
});

const TYPES: AssetType[] = ["conta", "investimento", "veiculo", "imovel", "outro"];

function Patrimonio() {
  const state = useFinance();
  const nw = netWorth(state);
  const [open, setOpen] = useState<null | "asset" | "debt">(null);

  const groups = TYPES.map((t) => ({
    type: t,
    label: ASSET_LABELS[t],
    items: state.assets.filter((a) => a.type === t),
    total: state.assets.filter((a) => a.type === t).reduce((a, x) => a + x.value, 0),
  }));

  return (
    <AppShell>
      <PageHeader subtitle="Você é dono de" title="Patrimônio" />
      <div className="px-6 space-y-4">
        <div className="rounded-3xl bg-card p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Patrimônio líquido</p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums"
            style={{ color: nw.net >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}
          >
            {formatBRL(nw.net)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-card-elevated p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Bens</p>
              <p className="font-bold tabular-nums">{formatBRL(nw.assets)}</p>
            </div>
            <div className="rounded-2xl bg-card-elevated p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Dívidas</p>
              <p className="font-bold tabular-nums">{formatBRL(nw.debts)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                inclui {formatBRL(futureInstallmentsTotal(state))} em parcelas
              </p>
            </div>
          </div>
        </div>

        <InvestmentSimulator />



        {groups.map((g) => (
          <section key={g.type}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {g.label}
              </h2>
              <span className="text-xs font-bold tabular-nums text-foreground">{formatBRL(g.total)}</span>
            </div>
            <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
              {g.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nada cadastrado.</p>
              )}
              {g.items.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground">{a.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums">{formatBRL(a.value)}</span>
                    <button onClick={() => financeActions.removeAsset(a.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Dívidas</h2>
            <span className="text-xs font-bold tabular-nums">{formatBRL(state.debts.reduce((a, d) => a + d.value, 0))}</span>
          </div>
          <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
            {state.debts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dívidas cadastradas.</p>
            )}
            {state.debts.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-foreground">{d.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">{formatBRL(d.value)}</span>
                  <button onClick={() => financeActions.removeDebt(d.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOpen("asset")}
            className="rounded-2xl border-2 border-dashed border-border py-4 text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Bem
          </button>
          <button
            onClick={() => setOpen("debt")}
            className="rounded-2xl border-2 border-dashed border-border py-4 text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Dívida
          </button>
        </div>
      </div>

      {open === "asset" && <AddAsset onClose={() => setOpen(null)} />}
      {open === "debt" && <AddDebt onClose={() => setOpen(null)} />}
    </AppShell>
  );
}

function AddAsset({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<AssetType>("conta");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  return (
    <Sheet onClose={onClose} title="Novo bem">
      <Field label="Tipo">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
          {TYPES.map((t) => <option key={t} value={t}>{ASSET_LABELS[t]}</option>)}
        </select>
      </Field>
      <Field label="Nome">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Carro Honda" />
      </Field>
      <Field label="Valor (R$)">
        <input type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <button
        className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold"
        onClick={() => {
          if (!name || !value) return;
          financeActions.addAsset({ type, name, value: Number(value) });
          onClose();
        }}
      >
        Adicionar bem
      </button>
    </Sheet>
  );
}

function AddDebt({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  return (
    <Sheet onClose={onClose} title="Nova dívida">
      <Field label="Nome">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Empréstimo" />
      </Field>
      <Field label="Valor (R$)">
        <input type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <button
        className="w-full rounded-2xl bg-destructive text-destructive-foreground py-3.5 font-bold"
        onClick={() => {
          if (!name || !value) return;
          financeActions.addDebt({ name, value: Number(value) });
          onClose();
        }}
      >
        Adicionar dívida
      </button>
    </Sheet>
  );
}

// ===== Simulador de rentabilidade =====

const CDI_ANNUAL = 0.105; // 10,5% a.a.
const POUPANCA_MONTHLY = 0.005; // 0,5% a.m.

const INVEST_TYPES = ["CDI", "CDB", "LCI", "LCA", "Poupança", "Outros"] as const;
type InvestType = (typeof INVEST_TYPES)[number];

/** Retorna as taxas anual e mensal (em fração) para o tipo escolhido. */
function investRates(type: InvestType): { annual: number; monthly: number; note: string } {
  switch (type) {
    case "CDI":
    case "CDB":
      return { annual: CDI_ANNUAL, monthly: Math.pow(1 + CDI_ANNUAL, 1 / 12) - 1, note: "10,5% a.a. (CDI)" };
    case "LCI":
    case "LCA": {
      const annual = CDI_ANNUAL * 0.85; // 85% do CDI, isento de IR
      return { annual, monthly: Math.pow(1 + annual, 1 / 12) - 1, note: "85% do CDI · isento de IR" };
    }
    case "Poupança": {
      const annual = Math.pow(1 + POUPANCA_MONTHLY, 12) - 1;
      return { annual, monthly: POUPANCA_MONTHLY, note: "0,5% a.m." };
    }
    default:
      return { annual: CDI_ANNUAL, monthly: Math.pow(1 + CDI_ANNUAL, 1 / 12) - 1, note: "estimativa baseada no CDI" };
  }
}

const TERMS = [
  { label: "1 mês", months: 1 },
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "1 ano", months: 12 },
  { label: "5 anos", months: 60 },
] as const;

function InvestmentSimulator() {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<InvestType>("CDI");
  const [customRate, setCustomRate] = useState("12"); // % a.a. para "Outros"
  const [months, setMonths] = useState<number>(12);

  // Taxa mensal efetiva conforme o tipo (ou taxa personalizada em "Outros").
  const monthlyRate = useMemo(() => {
    if (type === "Outros") {
      const annual = (Number(customRate.replace(",", ".")) || 0) / 100;
      return Math.pow(1 + annual, 1 / 12) - 1;
    }
    return investRates(type).monthly;
  }, [type, customRate]);

  const annualRate = Math.pow(1 + monthlyRate, 12) - 1;

  const result = useMemo(() => {
    const parsed = Number(amount.replace(",", "."));
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const finalValue = value * Math.pow(1 + monthlyRate, months);
    const series = Array.from({ length: months + 1 }, (_, m) => ({
      m,
      label: m === 0 ? "Hoje" : `${m}m`,
      total: Math.round(value * Math.pow(1 + monthlyRate, m)),
    }));
    return {
      value,
      finalValue,
      accumulated: finalValue - value,
      monthlyYield: value * monthlyRate,
      annualYield: value * annualRate,
      series,
    };
  }, [amount, monthlyRate, annualRate, months]);

  // Comparação entre todos os tipos para o mesmo valor e prazo.
  const comparison = useMemo(() => {
    return INVEST_TYPES.filter((t) => t !== "Outros").map((t) => {
      const mr = investRates(t).monthly;
      const fv = result.value * Math.pow(1 + mr, months);
      return { type: t, gain: fv - result.value, final: fv };
    }).sort((a, b) => b.final - a.final);
  }, [result.value, months]);

  // Validação em tempo real
  const amountNum = Number(amount.replace(",", "."));
  const amountError =
    amount.trim() === ""
      ? null
      : !Number.isFinite(amountNum) || Number.isNaN(amountNum)
      ? "Digite um número válido."
      : amountNum <= 0
      ? "O valor deve ser maior que zero."
      : null;

  const rateNum = Number(customRate.replace(",", "."));
  const rateError =
    type !== "Outros"
      ? null
      : customRate.trim() === ""
      ? "Informe a taxa anual."
      : !Number.isFinite(rateNum) || Number.isNaN(rateNum)
      ? "Digite um número válido."
      : rateNum <= 0
      ? "A taxa deve ser maior que zero."
      : null;

  const baseInput =
    "mt-1.5 w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 transition-colors";

  return (
    <section className="rounded-3xl bg-card border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Simulador de investimentos
        </h2>
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Valor inicial investido (R$)
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ex.: 1000"
          aria-invalid={!!amountError}
          className={`${baseInput} ${amountError ? "ring-2 ring-destructive border border-destructive" : "ring-primary"}`}
        />
        {amountError && (
          <p className="mt-1 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
            {amountError}
          </p>
        )}
      </label>


      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Tipo
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InvestType)}
            className="mt-1.5 w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
          >
            {INVEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Prazo
          </span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="mt-1.5 w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
          >
            {TERMS.map((t) => (
              <option key={t.months} value={t.months}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {type === "Outros" && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Taxa anual (%)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
            placeholder="Ex.: 12"
            aria-invalid={!!rateError}
            className={`${baseInput} ${rateError ? "ring-2 ring-destructive border border-destructive" : "ring-primary"}`}
          />
          {rateError && (
            <p className="mt-1 text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              {rateError}
            </p>
          )}
        </label>
      )}

      {/* Gráfico de crescimento do patrimônio */}
      {result.value > 0 && (
        <div className="rounded-2xl bg-card-elevated p-3">
          <p className="text-[11px] uppercase text-muted-foreground mb-2">
            Crescimento estimado
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={result.series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" interval="preserveStartEnd" />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                labelFormatter={(l: string) => `Mês ${l}`}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#growth)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card-elevated p-4">
          <p className="text-[11px] uppercase text-muted-foreground">Rendimento mensal</p>
          <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
            {formatBRL(result.monthlyYield)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {(monthlyRate * 100).toFixed(2)}% a.m.
          </p>
        </div>
        <div className="rounded-2xl bg-card-elevated p-4">
          <p className="text-[11px] uppercase text-muted-foreground">Rendimento anual</p>
          <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
            {formatBRL(result.annualYield)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {(annualRate * 100).toFixed(2)}% a.a.
          </p>
        </div>
        <div className="rounded-2xl bg-card-elevated p-4">
          <p className="text-[11px] uppercase text-muted-foreground">Juros acumulados</p>
          <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
            {formatBRL(result.accumulated)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">em {months} meses</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-4">
          <p className="text-[11px] uppercase text-muted-foreground">Valor final</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-primary">
            {formatBRL(result.finalValue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">capital + juros</p>
        </div>
      </div>

      {/* Comparação entre investimentos */}
      {result.value > 0 && (
        <div className="rounded-2xl bg-card-elevated p-4 space-y-2">
          <p className="text-[11px] uppercase text-muted-foreground">
            Comparação no prazo selecionado
          </p>
          {comparison.map((c, i) => (
            <div key={c.type} className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">
                {i === 0 && "🏆 "}{c.type}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatBRL(c.final)}{" "}
                <span style={{ color: "var(--color-success)" }}>(+{formatBRL(c.gain)})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        {type === "Outros"
          ? "Taxa personalizada informada por você."
          : `Taxa considerada: ${investRates(type).note}.`}{" "}
        Valores estimados, sem garantia de rentabilidade futura.
      </p>
    </section>
  );
}


function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-12 rounded-full bg-muted mx-auto" />
        <h2 className="text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}