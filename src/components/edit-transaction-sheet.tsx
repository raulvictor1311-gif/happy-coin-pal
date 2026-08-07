import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  financeActions,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Transaction,
} from "@/lib/finance-store";

/** Folha de edição rápida de uma transação (descrição, valor, categoria, data, tipo). */
export function EditTransactionSheet({
  tx,
  onClose,
}: {
  tx: Transaction | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Transaction["kind"]>("despesa");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tx) return;
    setKind(tx.kind);
    setDescription(tx.description);
    setAmount(String(tx.amount).replace(".", ","));
    setCategory(tx.category);
    setDate(new Date(tx.date).toISOString().slice(0, 10));
  }, [tx]);

  if (!tx) return null;

  const categories = kind === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const parsed = Number(amount.replace(/\./g, "").replace(",", "."));
  const valid = description.trim().length > 0 && Number.isFinite(parsed) && parsed > 0 && !!date;

  function save() {
    if (!valid || !tx) return;
    setSaving(true);
    try {
      financeActions.updateTransaction(tx.id, {
        kind,
        amount: parsed,
        category: category || categories[0],
        description: description.trim(),
        date: new Date(`${date}T12:00:00`).toISOString(),
      });
      toast.success("Transação atualizada.");
      onClose();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] bg-card border-t border-border p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Editar
            </p>
            <p className="text-lg font-bold text-foreground">Transação</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["despesa", "receita"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setCategory("");
              }}
              className={`rounded-2xl border py-3 text-sm font-bold capitalize transition-colors ${
                kind === k
                  ? "border-primary bg-card-elevated text-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <Field label="Descrição">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl bg-card-elevated border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Ex.: Mercado do bairro"
          />
        </Field>

        <Field label="Valor (R$)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-2xl bg-card-elevated border border-border px-4 py-3 text-sm text-foreground tabular-nums outline-none focus:border-primary"
            placeholder="0,00"
          />
        </Field>

        <Field label="Data">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl bg-card-elevated border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </Field>

        <Field label="Categoria">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  category === c
                    ? "border-primary bg-card-elevated text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <button
          onClick={save}
          disabled={!valid || saving}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      {children}
    </div>
  );
}
