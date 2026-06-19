import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  installmentAmount,
  getAllInstallmentEntries,
  futureInstallmentsTotal,
  installmentsByMonth,
  INSTALLMENT_CATEGORIES,
  type InstallmentPurchase,
} from "@/lib/finance-store";
import { formatBRL, formatCompactBRL } from "@/lib/format";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/parcelas")({
  head: () => ({ meta: [{ title: "Parcelas — Finlux" }] }),
  component: Parcelas,
});

function Parcelas() {
  const state = useFinance();
  const [open, setOpen] = useState(false);
  const totalFuture = futureInstallmentsTotal(state);
  const monthBuckets = installmentsByMonth(state, 6);
  const thisMonth = monthBuckets[0]?.total ?? 0;
  const incomePct = state.monthlyIncome > 0 ? (thisMonth / state.monthlyIncome) * 100 : 0;
  const alertOn = incomePct > state.installmentAlertPct;

  const calendar = useMemo(
    () => getAllInstallmentEntries(state).filter((e) => !e.paid),
    [state],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, typeof calendar>();
    for (const e of calendar) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).slice(0, 12);
  }, [calendar]);

  return (
    <AppShell>
      <PageHeader subtitle="Cartão de crédito" title="Compras parceladas" />

      <div className="px-6 space-y-4">
        {/* Resumo */}
        <div className="rounded-3xl bg-card p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total comprometido</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            {formatBRL(totalFuture)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="Este mês" value={thisMonth} />
            <Mini label="% da renda" value={incomePct} suffix="%" tone={alertOn ? "danger" : "ok"} />
          </div>
          {alertOn && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-destructive/15 text-destructive p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Suas parcelas comprometem {incomePct.toFixed(0)}% da renda — acima do limite de{" "}
                {state.installmentAlertPct}% definido.
              </span>
            </div>
          )}
          <Link to="/mais" className="mt-3 inline-block text-xs text-primary font-semibold">
            Ajustar renda e alerta →
          </Link>
        </div>

        {/* Compras */}
        <div className="space-y-3">
          {state.installmentPurchases.map((p) => (
            <PurchaseCard key={p.id} p={p} />
          ))}
          {state.installmentPurchases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma compra parcelada cadastrada.
            </p>
          )}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border-2 border-dashed border-border py-5 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" /> Nova compra parcelada
        </button>

        {/* Calendário */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
            Calendário de parcelas
          </h2>
          <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sem parcelas futuras.</p>
            )}
            {grouped.map(([key, items]) => {
              const d = items[0].date;
              const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
              const total = items.reduce((a, e) => a + e.amount, 0);
              return (
                <div key={key} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-foreground capitalize">{label}</p>
                    <p className="text-sm font-bold tabular-nums text-foreground">{formatBRL(total)}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((e) => (
                      <li key={`${e.purchaseId}-${e.number}`} className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {e.name}{" "}
                          <span className="text-foreground/60">
                            ({e.number}/{e.total})
                          </span>
                        </span>
                        <span className="tabular-nums">{formatBRL(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {open && <AddInstallment onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

function Mini({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone?: "ok" | "danger" }) {
  const color = tone === "danger" ? "var(--color-destructive)" : "var(--color-foreground)";
  return (
    <div className="rounded-2xl bg-card-elevated p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums" style={{ color }}>
        {suffix === "%" ? `${value.toFixed(0)}%` : formatCompactBRL(value)}
      </p>
    </div>
  );
}

function PurchaseCard({ p }: { p: InstallmentPurchase }) {
  const state = useFinance();
  const card = state.cards.find((c) => c.id === p.cardId);
  const amount = installmentAmount(p);
  const remaining = p.installments - p.paid;
  const pct = Math.round((p.paid / p.installments) * 100);
  return (
    <div className="rounded-3xl bg-card border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-foreground truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground">
            {p.category} • {card?.name ?? "Cartão"}
          </p>
        </div>
        <button
          onClick={() => financeActions.removeInstallment(p.id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-card-elevated p-2">
          <p className="text-[10px] uppercase text-muted-foreground">Total</p>
          <p className="text-sm font-bold tabular-nums">{formatBRL(p.total)}</p>
        </div>
        <div className="rounded-xl bg-card-elevated p-2">
          <p className="text-[10px] uppercase text-muted-foreground">Parcela</p>
          <p className="text-sm font-bold tabular-nums">{formatBRL(amount)}</p>
        </div>
        <div className="rounded-xl bg-card-elevated p-2">
          <p className="text-[10px] uppercase text-muted-foreground">Restam</p>
          <p className="text-sm font-bold tabular-nums">{remaining}x</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            Pagas {p.paid}/{p.installments}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={remaining === 0}
          onClick={() => financeActions.payInstallment(p.id, 1)}
          className="flex-1 rounded-xl bg-card-elevated py-2 text-xs font-semibold text-foreground disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <Check className="h-3.5 w-3.5" /> Pagar 1
        </button>
        <button
          disabled={remaining === 0}
          onClick={() => financeActions.payOffInstallment(p.id)}
          className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-bold disabled:opacity-40"
        >
          Quitar
        </button>
      </div>
    </div>
  );
}

function AddInstallment({ onClose }: { onClose: () => void }) {
  const state = useFinance();
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [installments, setInstallments] = useState("12");
  const [cardId, setCardId] = useState(state.cards[0]?.id ?? "");
  const [category, setCategory] = useState(INSTALLMENT_CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const parcela = Number(total) && Number(installments) ? Number(total) / Number(installments) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-12 rounded-full bg-muted mx-auto" />
        <h2 className="text-xl font-bold">Nova compra parcelada</h2>

        <Field label="Nome da compra">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Notebook" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor total (R$)">
            <input type="number" className={inputCls} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="2400" />
          </Field>
          <Field label="Parcelas">
            <input type="number" min={1} max={48} className={inputCls} value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-2xl bg-card-elevated px-4 py-3 text-sm flex justify-between">
          <span className="text-muted-foreground">Valor de cada parcela</span>
          <span className="font-bold tabular-nums">{formatBRL(parcela)}</span>
        </div>
        <Field label="Data da compra">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Cartão">
          <select className={inputCls} value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {state.cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {INSTALLMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <button
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold active:scale-[0.98] transition-transform"
          onClick={() => {
            if (!name || !total || !installments || !cardId) return;
            financeActions.addInstallment({
              name,
              total: Number(total),
              installments: Number(installments),
              cardId,
              category,
              date: new Date(date).toISOString(),
            });
            onClose();
          }}
        >
          Salvar compra
        </button>
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