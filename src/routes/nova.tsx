import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Calendar, Repeat, Layers, Circle } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  colorForCategory,
  financeActions,
} from "@/lib/finance-store";

type Kind = "receita" | "despesa" | "transferencia";
type Mode = "unica" | "recorrente" | "parcelada";
type Frequency = "semanal" | "mensal" | "anual";

type NovaSearch = { kind?: Kind };

export const Route = createFileRoute("/nova")({
  head: () => ({ meta: [{ title: "Nova transação — Finlux" }] }),
  validateSearch: (s: Record<string, unknown>): NovaSearch => {
    const k = s.kind;
    if (k === "receita" || k === "despesa" || k === "transferencia") return { kind: k };
    return {};
  },
  component: Nova,
});

const KIND_META: Record<Kind, { label: string; color: string; icon: typeof ArrowDownLeft }> = {
  receita: { label: "Receita", color: "var(--color-success)", icon: ArrowDownLeft },
  despesa: { label: "Despesa", color: "var(--color-destructive)", icon: ArrowUpRight },
  transferencia: { label: "Transferência", color: "var(--color-primary)", icon: ArrowLeftRight },
};

function Nova() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [kind, setKind] = useState<Kind>(search.kind ?? "despesa");
  const [mode, setMode] = useState<Mode>("unica");
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [installments, setInstallments] = useState(2);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [destination, setDestination] = useState("");

  const cats = useMemo(() => {
    if (kind === "receita") return INCOME_CATEGORIES;
    if (kind === "transferencia") return ["Transferência"];
    return EXPENSE_CATEGORIES;
  }, [kind]);
  const [category, setCategory] = useState(cats[0]);

  function changeKind(k: Kind) {
    setKind(k);
    const next = k === "receita" ? INCOME_CATEGORIES : k === "transferencia" ? ["Transferência"] : EXPENSE_CATEGORIES;
    setCategory(next[0]);
    if (k === "transferencia") setMode("unica");
  }

  function submit() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const base = new Date(date);

    if (kind === "transferencia") {
      const desc = description || `Transferência${destination ? ` → ${destination}` : ""}`;
      financeActions.addTransaction({
        kind: "despesa",
        amount: value,
        category: "Transferência",
        description: desc,
        date: base.toISOString(),
      });
      if (destination) {
        financeActions.addTransaction({
          kind: "receita",
          amount: value,
          category: "Transferência",
          description: `Recebido de transferência`,
          date: base.toISOString(),
        });
      }
      navigate({ to: "/" });
      return;
    }

    if (mode === "parcelada") {
      const each = value / installments;
      for (let i = 0; i < installments; i++) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        financeActions.addTransaction({
          kind,
          amount: each,
          category,
          description: `${description || category} (${i + 1}/${installments})`,
          date: d.toISOString(),
          installments,
        });
      }
    } else if (mode === "recorrente") {
      const count = frequency === "semanal" ? 12 : frequency === "mensal" ? 12 : 3;
      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        if (frequency === "semanal") d.setDate(d.getDate() + i * 7);
        else if (frequency === "mensal") d.setMonth(d.getMonth() + i);
        else d.setFullYear(d.getFullYear() + i);
        financeActions.addTransaction({
          kind,
          amount: value,
          category,
          description: description || category,
          date: d.toISOString(),
        });
      }
    } else {
      financeActions.addTransaction({
        kind,
        amount: value,
        category,
        description: description || category,
        date: base.toISOString(),
      });
    }
    navigate({ to: "/" });
  }

  const accent = KIND_META[kind].color;

  return (
    <AppShell>
      <PageHeader subtitle="Adicionar" title="Nova transação" />
      <div className="px-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Kind selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-card rounded-2xl border border-border">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const Icon = KIND_META[k].icon;
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => changeKind(k)}
                className="py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-95"
                style={{
                  backgroundColor: active ? KIND_META[k].color : "transparent",
                  color: active ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
                }}
              >
                <Icon className="h-4 w-4" />
                {KIND_META[k].label}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div
          className="rounded-3xl border p-6 text-center transition-colors"
          style={{
            backgroundColor: `color-mix(in oklab, ${accent} 6%, var(--color-card))`,
            borderColor: `color-mix(in oklab, ${accent} 25%, var(--color-border))`,
          }}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Valor</p>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-2xl text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              placeholder="0,00"
              className="bg-transparent text-4xl font-bold outline-none text-center w-48 tabular-nums placeholder:text-muted-foreground/40"
              style={{ color: accent }}
            />
          </div>
        </div>

        {/* Mode (only for receita/despesa) */}
        {kind !== "transferencia" && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Tipo
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "unica", label: "Única", icon: Circle },
                { v: "recorrente", label: "Recorrente", icon: Repeat },
                { v: "parcelada", label: "Parcelada", icon: Layers },
              ] as { v: Mode; label: string; icon: typeof Circle }[]).map(({ v, label, icon: Icon }) => {
                const active = mode === v;
                return (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold border transition-all active:scale-95 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {mode === "recorrente" && (
              <div className="mt-3 flex gap-2">
                {(["semanal", "mensal", "anual"] as Frequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                      frequency === f
                        ? "bg-card-elevated text-foreground border border-primary"
                        : "bg-card text-muted-foreground border border-border"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {mode === "parcelada" && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Parcelas
                </span>
                <input
                  type="number"
                  min={2}
                  max={48}
                  value={installments}
                  onChange={(e) => setInstallments(Math.max(2, Math.min(48, Number(e.target.value) || 2)))}
                  className="ml-auto w-20 bg-card-elevated rounded-lg px-3 py-1.5 text-foreground outline-none text-center font-bold tabular-nums"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  ≈ R$ {amount ? (Number(amount) / installments).toFixed(2) : "0,00"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Destination (transferência only) */}
        {kind === "transferencia" && (
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Destino
            </span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex.: Conta Poupança, João"
              className="mt-1.5 w-full bg-card rounded-2xl px-4 py-3 text-foreground border border-border outline-none focus:ring-2 ring-primary"
            />
          </label>
        )}

        {/* Categories with colors */}
        {kind !== "transferencia" && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Categoria
            </p>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const color = colorForCategory(c);
                const active = category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="px-3.5 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 flex items-center gap-2"
                    style={{
                      backgroundColor: active
                        ? `color-mix(in oklab, ${color} 20%, transparent)`
                        : "var(--color-card)",
                      borderColor: active ? color : "var(--color-border)",
                      color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Descrição
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Almoço com cliente"
            className="mt-1.5 w-full bg-card rounded-2xl px-4 py-3 text-foreground border border-border outline-none focus:ring-2 ring-primary"
          />
        </label>

        {/* Date */}
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Data
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full bg-card rounded-2xl px-4 py-3 text-foreground border border-border outline-none"
          />
        </label>

        <button
          onClick={submit}
          className="w-full rounded-2xl py-4 font-bold text-base text-primary-foreground active:scale-[0.98] transition-transform shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
          style={{ backgroundColor: accent }}
        >
          Salvar
        </button>
      </div>
    </AppShell>
  );
}
