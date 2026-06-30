import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  cardCurrentInvoice,
  futureInstallmentsTotal,
  cardCommittedTotal,
  installmentsByMonth,
} from "@/lib/finance-store";
import { formatBRL, formatCompactBRL } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/cartoes")({
  head: () => ({ meta: [{ title: "Cartões — Finlux" }] }),
  component: Cartoes,
});

function Cartoes() {
  const state = useFinance();
  const [open, setOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader subtitle="Crédito" title="Cartões" />
      <div className="px-6 space-y-4">
        {state.cards.map((c) => {
          const invoice = cardCurrentInvoice(state, c.id);
          const future = futureInstallmentsTotal(state, c.id);
          const committed = cardCommittedTotal(state, c.id);
          const available = Math.max(0, c.limit - committed);
          const pct = Math.min(100, Math.round((committed / c.limit) * 100));
          const buckets = installmentsByMonth(state, 6, c.id);
          const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
          return (
            <div
              key={c.id}
              className="rounded-3xl p-5 text-white relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${c.color}, color-mix(in oklab, ${c.color} 60%, black))`,
              }}
            >
              <button
                onClick={() => financeActions.removeCard(c.id)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
                aria-label="Remover cartão"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <p className="text-xs uppercase tracking-wider opacity-80">{c.brand}</p>
              <p className="text-xl font-bold mt-1">{c.name}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] opacity-80 uppercase tracking-wider">Fatura atual</p>
                  <p className="text-xl font-bold tabular-nums">{formatBRL(invoice)}</p>
                </div>
                <div>
                  <p className="text-[11px] opacity-80 uppercase tracking-wider">Parcelas futuras</p>
                  <p className="text-xl font-bold tabular-nums">{formatBRL(future)}</p>
                </div>
                <div>
                  <p className="text-[11px] opacity-80 uppercase tracking-wider">Limite</p>
                  <p className="text-base font-semibold tabular-nums">{formatBRL(c.limit)}</p>
                </div>
                <div>
                  <p className="text-[11px] opacity-80 uppercase tracking-wider">Disponível</p>
                  <p className="text-base font-semibold tabular-nums">{formatBRL(available)}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1.5 opacity-90">
                  <span>{pct}% comprometido</span>
                  <span>Vence dia {c.dueDay}</span>
                </div>
              </div>
              {/* Evolução dos compromissos parcelados (6 meses) */}
              <div className="mt-5">
                <p className="text-[11px] opacity-80 uppercase tracking-wider mb-2">
                  Próximas faturas (parcelas)
                </p>
                <div className="flex items-end gap-1.5 h-20">
                  {buckets.map((b) => {
                    const h = Math.round((b.total / maxBucket) * 100);
                    return (
                      <div key={b.key} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-white/15 rounded-md overflow-hidden flex items-end" style={{ height: "100%" }}>
                          <div className="w-full bg-white/85 rounded-md" style={{ height: `${h}%` }} />
                        </div>
                        <span className="text-[10px] opacity-80">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border-2 border-dashed border-border py-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" /> Adicionar cartão
        </button>

        <Link
          to="/parcelas"
          className="w-full rounded-3xl bg-card border border-border p-5 flex items-center justify-between hover:border-primary transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Compras parceladas</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {state.installmentPurchases.length} compras • {formatCompactBRL(futureInstallmentsTotal(state))} a pagar
            </p>
          </div>
          <span className="text-primary font-bold">→</span>
        </Link>
      </div>

      {open && <AddCard onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

function AddCard({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("Mastercard");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("28");
  const [dueDay, setDueDay] = useState("5");
  const [color, setColor] = useState("#8A2BE2");
  const [touched, setTouched] = useState(false);

  const limitNum = Number(limit);
  const closingNum = Number(closingDay);
  const dueNum = Number(dueDay);

  const nameError = !name.trim() ? "Informe o nome do cartão." : "";
  const limitError =
    !limit.trim() || Number.isNaN(limitNum) || limitNum <= 0
      ? "Limite deve ser maior que zero."
      : "";
  const closingError =
    !closingDay.trim() || Number.isNaN(closingNum) || closingNum < 1 || closingNum > 31
      ? "Dia 1–31."
      : "";
  const dueError =
    !dueDay.trim() || Number.isNaN(dueNum) || dueNum < 1 || dueNum > 31
      ? "Dia 1–31."
      : "";

  const baseInput = "w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary";
  const errCls = "border border-destructive";
  const show = (err: string) => touched && err;

  function save() {
    setTouched(true);
    if (nameError) return toast.error(nameError);
    if (limitError) return toast.error(limitError);
    if (closingError) return toast.error("Dia de fechamento inválido (1–31).");
    if (dueError) return toast.error("Dia de vencimento inválido (1–31).");

    financeActions.addCard({
      name: name.trim(),
      brand,
      limit: limitNum,
      closingDay: closingNum,
      dueDay: dueNum,
      color,
    });
    toast.success("Cartão adicionado com sucesso.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-12 rounded-full bg-muted mx-auto" />
        <h2 className="text-xl font-bold">Novo cartão</h2>
        <Field label="Nome">
          <input
            className={`${baseInput} ${show(nameError) ? errCls : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Nubank"
          />
          {show(nameError) && <p className="text-xs text-destructive mt-1">{nameError}</p>}
        </Field>
        <Field label="Bandeira">
          <select
            className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            {["Mastercard", "Visa", "Elo", "American Express", "Hipercard"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Limite (R$)">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            className={`${baseInput} ${show(limitError) ? errCls : ""}`}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="5000"
          />
          {show(limitError) && <p className="text-xs text-destructive mt-1">{limitError}</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fechamento">
            <input
              type="number"
              min={1}
              max={31}
              className={`${baseInput} ${show(closingError) ? errCls : ""}`}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
            />
            {show(closingError) && <p className="text-xs text-destructive mt-1">{closingError}</p>}
          </Field>
          <Field label="Vencimento">
            <input
              type="number"
              min={1}
              max={31}
              className={`${baseInput} ${show(dueError) ? errCls : ""}`}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
            {show(dueError) && <p className="text-xs text-destructive mt-1">{dueError}</p>}
          </Field>
        </div>
        <Field label="Cor">
          <div className="flex gap-2">
            {["#8A2BE2", "#FF6B6B", "#1ABC9C", "#3498DB", "#F39C12", "#111111"].map((c) => (
              <button
                key={c}
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full border-2 ${color === c ? "border-primary" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
        <button
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold active:scale-[0.98] transition-transform"
          onClick={save}
        >
          Salvar cartão
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}