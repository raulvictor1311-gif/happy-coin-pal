import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
  Repeat,
  Layers,
  Circle,
  Wallet,
  CreditCard as CreditCardIcon,
  Banknote,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  colorForCategory,
  financeActions,
  useFinance,
  cardCommittedTotal,
  type CreditCard,
} from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";

type Kind = "receita" | "despesa" | "transferencia";
type Mode = "unica" | "recorrente" | "parcelada";
type Frequency = "semanal" | "mensal" | "anual";
type PaymentMethod = "dinheiro" | "pix" | "debito" | "credito";
type InstallmentMode = "avista" | "parcelada";

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

const PAYMENT_METHODS: { v: PaymentMethod; label: string; icon: typeof Wallet }[] = [
  { v: "dinheiro", label: "Dinheiro", icon: Banknote },
  { v: "pix", label: "Pix", icon: Landmark },
  { v: "debito", label: "Débito", icon: Wallet },
  { v: "credito", label: "Crédito", icon: CreditCardIcon },
];

function Nova() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const state = useFinance();
  const [kind, setKind] = useState<Kind>(search.kind ?? "despesa");
  const [mode, setMode] = useState<Mode>("unica");
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [installments, setInstallments] = useState(2);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [destination, setDestination] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [cardId, setCardId] = useState<string>(state.cards[0]?.id ?? "");
  const [installmentMode, setInstallmentMode] = useState<InstallmentMode>("avista");

  const cats = useMemo(() => {
    if (kind === "receita") return INCOME_CATEGORIES;
    if (kind === "transferencia") return ["Transferência"];
    return EXPENSE_CATEGORIES;
  }, [kind]);
  const [category, setCategory] = useState(cats[0]);

  const isCredit = kind === "despesa" && paymentMethod === "credito";
  const isCreditInstallment = isCredit && installmentMode === "parcelada";
  const selectedCard: CreditCard | undefined = state.cards.find((c) => c.id === cardId);
  const amountNum = Number(amount) || 0;
  const parcelaValue = isCreditInstallment && installments > 0 ? amountNum / installments : 0;
  const availableLimit = selectedCard
    ? Math.max(0, selectedCard.limit - cardCommittedTotal(state, selectedCard.id))
    : 0;
  const exceedsLimit = !!selectedCard && amountNum > availableLimit;

  function changeKind(k: Kind) {
    setKind(k);
    const next = k === "receita" ? INCOME_CATEGORIES : k === "transferencia" ? ["Transferência"] : EXPENSE_CATEGORIES;
    setCategory(next[0]);
    if (k === "transferencia") setMode("unica");
    if (k !== "despesa") setPaymentMethod("dinheiro");
  }

  function submit() {
    const raw = amount.trim();
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) {
      toast.error(
        kind === "receita"
          ? "Receitas devem possuir valores positivos."
          : kind === "despesa"
            ? "Despesas devem possuir valores positivos."
            : "Informe um valor maior que zero.",
      );
      return;
    }
    if (!date) return toast.error("Selecione a data da transação.");

    if (kind === "transferencia") {
      if (!destination.trim() && !description.trim())
        return toast.error("Informe o destino da transferência.");
      const desc = description || `Transferência${destination ? ` → ${destination}` : ""}`;
      const base = new Date(date);
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
      toast.success("Transferência registrada com sucesso.");
      navigate({ to: "/" });
      return;
    }

    if (!category) return toast.error("Selecione uma categoria.");
    if (!description.trim()) return toast.error("Adicione uma descrição para a transação.");

    const base = new Date(date);

    // ===== Despesa + Cartão de Crédito =====
    if (isCredit) {
      if (!cardId || !selectedCard) return toast.error("Selecione o cartão utilizado.");
      if (exceedsLimit)
        return toast.error(
          `Valor excede o limite disponível (${formatBRL(availableLimit)}) do cartão.`,
        );

      if (installmentMode === "parcelada") {
        if (!installments || installments < 2)
          return toast.error("Parcelamento precisa de pelo menos 2 parcelas.");
        if (installments > 48) return toast.error("Máximo de 48 parcelas.");
        if (parcelaValue <= 0) return toast.error("Valor de parcela inválido.");

        financeActions.addInstallment({
          name: description.trim(),
          total: value,
          installments,
          cardId,
          category,
          date: base.toISOString(),
        });
        toast.success(
          `Compra parcelada em ${installments}x de ${formatBRL(parcelaValue)} registrada no ${selectedCard.name}.`,
        );
      } else {
        financeActions.addTransaction({
          kind: "despesa",
          amount: value,
          category,
          description: description.trim(),
          date: base.toISOString(),
          paymentMethod: "credito",
          cardId,
        });
        toast.success(`Despesa registrada no ${selectedCard.name}.`);
      }
      navigate({ to: "/" });
      return;
    }

    // ===== Modos legados (parcelada/recorrente sem cartão, única, receita) =====
    if (mode === "parcelada") {
      if (!installments || installments < 2)
        return toast.error("Parcelamento precisa de pelo menos 2 parcelas.");
      const each = value / installments;
      for (let i = 0; i < installments; i++) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        financeActions.addTransaction({
          kind,
          amount: each,
          category,
          description: `${description} (${i + 1}/${installments})`,
          date: d.toISOString(),
          installments,
        });
      }
      toast.success(`Compra parcelada em ${installments}x registrada.`);
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
          description,
          date: d.toISOString(),
        });
      }
      toast.success(`${kind === "receita" ? "Receita" : "Despesa"} recorrente criada (${count}x).`);
    } else {
      financeActions.addTransaction({
        kind,
        amount: value,
        category,
        description,
        date: base.toISOString(),
        paymentMethod: kind === "despesa" ? paymentMethod : undefined,
      });
      toast.success(kind === "receita" ? "Receita adicionada com sucesso." : "Despesa adicionada com sucesso.");
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

        {/* Payment method (only despesa) */}
        {kind === "despesa" && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Forma de pagamento
            </p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(({ v, label, icon: Icon }) => {
                const active = paymentMethod === v;
                return (
                  <button
                    key={v}
                    onClick={() => setPaymentMethod(v)}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-[11px] font-semibold border transition-all active:scale-95 ${
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
          </div>
        )}

        {/* Credit card flow */}
        {isCredit && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {state.cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
                Cadastre um cartão em <span className="text-foreground font-semibold">Cartões</span> para lançar compras no crédito.
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Cartão
                  </p>
                  <div className="grid gap-2">
                    {state.cards.map((c) => {
                      const active = cardId === c.id;
                      const avail = Math.max(0, c.limit - cardCommittedTotal(state, c.id));
                      return (
                        <button
                          key={c.id}
                          onClick={() => setCardId(c.id)}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3 border text-left transition-all active:scale-[0.98] ${
                            active ? "border-primary bg-card-elevated" : "border-border bg-card"
                          }`}
                        >
                          <span
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: c.color }}
                          >
                            <CreditCardIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {c.name} <span className="text-muted-foreground font-normal">• {c.brand}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              Disponível {formatBRL(avail)} • Fecha dia {c.closingDay} • Vence dia {c.dueDay}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Parcelamento
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "avista", label: "À vista" },
                      { v: "parcelada", label: "Parcelada" },
                    ] as { v: InstallmentMode; label: string }[]).map(({ v, label }) => {
                      const active = installmentMode === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setInstallmentMode(v)}
                          className={`rounded-2xl py-3 text-sm font-semibold border transition-all active:scale-95 ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-muted-foreground border-border"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {installmentMode === "parcelada" && (
                  <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
                    <label className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                        Quantidade de parcelas
                      </span>
                      <input
                        type="number"
                        min={2}
                        max={48}
                        inputMode="numeric"
                        value={installments}
                        onChange={(e) => setInstallments(Math.min(48, Math.max(2, Number(e.target.value) || 2)))}
                        className="w-20 bg-card-elevated rounded-lg px-3 py-1.5 text-foreground outline-none text-center font-bold tabular-nums"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-card-elevated p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground">Valor total</p>
                        <p className="font-bold tabular-nums">{formatBRL(amountNum)}</p>
                      </div>
                      <div className="rounded-xl bg-card-elevated p-2.5">
                        <p className="text-[10px] uppercase text-muted-foreground">Cada parcela</p>
                        <p className="font-bold tabular-nums text-primary">{formatBRL(parcelaValue)}</p>
                      </div>
                    </div>
                    {selectedCard && (
                      <p className="text-[11px] text-muted-foreground">
                        1ª parcela vence em {new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 1, Math.min(selectedCard.dueDay, 28)).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}

                {exceedsLimit && (
                  <p className="text-xs text-destructive">
                    Valor excede o limite disponível ({formatBRL(availableLimit)}) do cartão selecionado.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Mode (only for receita/despesa, hidden when using credit card) */}
        {kind !== "transferencia" && !isCredit && (
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
                  inputMode="numeric"
                  value={installments}
                  onChange={(e) => setInstallments(Math.max(2, Number(e.target.value) || 2))}
                  className="ml-auto w-24 bg-card-elevated rounded-lg px-3 py-1.5 text-foreground outline-none text-center font-bold tabular-nums"
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
            placeholder={isCreditInstallment ? "Ex.: Notebook Dell" : "Ex.: Almoço com cliente"}
            className="mt-1.5 w-full bg-card rounded-2xl px-4 py-3 text-foreground border border-border outline-none focus:ring-2 ring-primary"
          />
        </label>

        {/* Date */}
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {isCreditInstallment ? "Data da compra" : "Data"}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full bg-card rounded-2xl px-4 py-3 text-foreground border border-border outline-none"
          />
        </label>

        {/* Summary for credit installment */}
        {isCreditInstallment && amountNum > 0 && selectedCard && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-1 animate-in fade-in duration-200">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">Resumo</p>
            <p className="text-sm text-foreground">
              <span className="font-bold">{installments}x</span> de{" "}
              <span className="font-bold tabular-nums">{formatBRL(parcelaValue)}</span> no {selectedCard.name}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Total {formatBRL(amountNum)} • Limite após compra {formatBRL(Math.max(0, availableLimit - amountNum))}
            </p>
          </div>
        )}

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
