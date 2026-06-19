import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, financeActions, type TxKind } from "@/lib/finance-store";
import { enqueueTx } from "@/lib/sync-queue";
import { isOnline } from "@/lib/network-status";

export const Route = createFileRoute("/nova")({
  head: () => ({ meta: [{ title: "Nova transação — Finlux" }] }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<TxKind>("despesa");
  const cats = kind === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(cats[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  function submit() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    const id = financeActions.addTransaction({
      kind,
      amount: value,
      category,
      description: description || category,
      date: new Date(date).toISOString(),
    });
    // Always enqueue — flushes immediately when online, waits otherwise.
    enqueueTx(id);
    if (!isOnline()) {
      // Visual hint handled by the global offline banner.
    }
    navigate({ to: "/" });
  }

  return (
    <AppShell>
      <PageHeader subtitle="Adicionar" title="Nova transação" />
      <div className="px-6 space-y-5">
        <div className="grid grid-cols-2 gap-2 p-1 bg-card rounded-2xl border border-border">
          {(["despesa", "receita"] as TxKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setCategory((k === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0]);
              }}
              className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                kind === k
                  ? k === "receita"
                    ? "bg-success text-primary-foreground"
                    : "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground"
              }`}
              style={
                kind === k
                  ? {
                      backgroundColor:
                        k === "receita" ? "var(--color-success)" : "var(--color-destructive)",
                      color: "var(--color-primary-foreground)",
                    }
                  : undefined
              }
            >
              {k === "receita" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-card border border-border p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Valor
          </p>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-2xl text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              placeholder="0,00"
              className="bg-transparent text-4xl font-bold text-foreground outline-none text-center w-48 tabular-nums placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Categoria
          </p>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

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

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Data
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
          className="w-full rounded-2xl bg-primary text-primary-foreground py-4 font-bold text-base active:scale-[0.98] transition-transform"
        >
          Salvar
        </button>
      </div>
    </AppShell>
  );
}