import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  colorForCategory,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Trash2, Search, SlidersHorizontal, X, ArrowUpDown, Check, Loader2, Pencil } from "lucide-react";
import { EditTransactionSheet } from "@/components/edit-transaction-sheet";
import type { Transaction } from "@/lib/finance-store";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/extrato")({
  head: () => ({ meta: [{ title: "Extrato — Finlux" }] }),
  component: Extrato,
});

type Kind = "todos" | "receita" | "despesa";
type Period = "todos" | "7d" | "30d" | "mes";
type Sort = "recentes" | "antigos" | "maior" | "menor";

function Extrato() {
  const state = useFinance();

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 380);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("todos");
  const [period, setPeriod] = useState<Period>("30d");
  const [category, setCategory] = useState<string>("todas");
  const [sort, setSort] = useState<Sort>("recentes");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function handleRemove(id: string) {
    setDeletingId(id);
    try {
      await financeActions.removeTransaction(id);
      toast.success("Transação excluída.");
    } catch {
      toast.error("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  const allCategories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, "Transferência"])),
    [],
  );

  const filtered = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;
    if (period === "7d") from = new Date(now.getTime() - 7 * 86400_000);
    else if (period === "30d") from = new Date(now.getTime() - 30 * 86400_000);
    else if (period === "mes") from = new Date(now.getFullYear(), now.getMonth(), 1);

    const q = query.trim().toLowerCase();
    let list = state.transactions.filter((t) => {
      if (kind !== "todos" && t.kind !== kind) return false;
      if (category !== "todas" && t.category !== category) return false;
      if (from && new Date(t.date) < from) return false;
      if (q) {
        const hay = `${t.description} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "recentes") return +new Date(b.date) - +new Date(a.date);
      if (sort === "antigos") return +new Date(a.date) - +new Date(b.date);
      if (sort === "maior") return b.amount - a.amount;
      return a.amount - b.amount;
    });
    return list;
  }, [state.transactions, kind, category, period, query, sort]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const t of filtered) {
      const d = new Date(t.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      });
      (map[d] ||= []).push(t);
    }
    return map;
  }, [filtered]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
    const expense = filtered.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  const activeFilters =
    (kind !== "todos" ? 1 : 0) + (category !== "todas" ? 1 : 0) + (period !== "30d" ? 1 : 0);

  function clearAll() {
    setKind("todos");
    setCategory("todas");
    setPeriod("30d");
    setQuery("");
    setSort("recentes");
  }

  return (
    <AppShell>
      <PageHeader subtitle="Movimentos" title="Extrato" />

      {/* Search + filter button */}
      <div className="px-6 flex items-center gap-2 animate-in fade-in duration-300">
        <label className="flex-1 flex items-center gap-2 rounded-2xl bg-card border border-border px-3.5 py-2.5 focus-within:ring-2 ring-primary">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descrição ou categoria"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Filtros"
          className="relative h-11 w-11 rounded-2xl bg-card border border-border flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Kind chips */}
      <div className="px-6 mt-3 flex gap-2 overflow-x-auto scrollbar-none">
        {(["todos", "receita", "despesa"] as Kind[]).map((f) => (
          <button
            key={f}
            onClick={() => setKind(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              kind === f
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {f === "todos" ? "Todos" : f === "receita" ? "Receitas" : "Despesas"}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        <button
          onClick={() =>
            setSort((s) =>
              s === "recentes" ? "antigos" : s === "antigos" ? "maior" : s === "maior" ? "menor" : "recentes",
            )
          }
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-card text-muted-foreground border border-border whitespace-nowrap flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sort === "recentes"
            ? "Recentes"
            : sort === "antigos"
            ? "Antigos"
            : sort === "maior"
            ? "Maior valor"
            : "Menor valor"}
        </button>
      </div>

      {/* Totals summary */}
      {!loading && filtered.length > 0 && (
        <section className="px-6 mt-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div className="rounded-2xl bg-card border border-border p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Entradas
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
                {formatBRL(totals.income)}
              </p>
            </div>
            <div className="border-x border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Saídas
              </p>
              <p
                className="mt-1 text-sm font-bold tabular-nums"
                style={{ color: "var(--color-destructive)" }}
              >
                {formatBRL(totals.expense)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Líquido
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                {formatBRL(totals.net)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* List */}
      <div className="px-6 mt-5 space-y-6 pb-6">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-20 w-full rounded-3xl" />
            <Skeleton className="h-3 w-24 mt-4" />
            <Skeleton className="h-28 w-full rounded-3xl" />
          </div>
        )}

        {!loading &&
          Object.entries(grouped).map(([day, list], idx) => (
            <div
              key={day}
              className="animate-in fade-in slide-in-from-bottom-1 duration-300"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {day}
              </p>
              <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
                {list.map((t) => {
                  const color = colorForCategory(t.category);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-4">
                      <span
                        className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
                        }}
                      >
                        <span style={{ color }} className="font-bold text-base">
                          {t.kind === "receita" ? "↑" : "↓"}
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {t.description}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {t.category}
                        </p>
                      </div>
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{
                          color:
                            t.kind === "receita"
                              ? "var(--color-success)"
                              : "var(--color-destructive)",
                        }}
                      >
                        {t.kind === "receita" ? "+" : "-"}
                        {formatBRL(t.amount)}
                      </span>
                      <button
                        onClick={() => setEditing(t)}
                        aria-label="Editar"
                        className="text-muted-foreground hover:text-primary ml-1 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(t.id)}
                        disabled={deletingId === t.id}
                        aria-label="Remover"
                        className="text-muted-foreground hover:text-[var(--color-destructive)] ml-1 transition-colors disabled:opacity-50"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 animate-in fade-in duration-300">
            <p className="text-sm text-muted-foreground">Nenhum movimento encontrado.</p>
            {(activeFilters > 0 || query) && (
              <button
                onClick={clearAll}
                className="mt-3 text-sm font-semibold text-primary"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <EditTransactionSheet tx={editing} onClose={() => setEditing(null)} />

      {/* Filters bottom sheet */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[2rem] bg-card border-t border-border p-6 pb-10 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                  Refinar
                </p>
                <h2 className="text-xl font-bold text-foreground mt-1">Filtros</h2>
              </div>
              <button
                aria-label="Fechar"
                onClick={() => setFiltersOpen(false)}
                className="h-10 w-10 rounded-full bg-card-elevated flex items-center justify-center text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Período
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { v: "7d", label: "7 dias" },
                      { v: "30d", label: "30 dias" },
                      { v: "mes", label: "Mês" },
                      { v: "todos", label: "Tudo" },
                    ] as { v: Period; label: string }[]
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => setPeriod(v)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
                        period === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-card-elevated text-muted-foreground border border-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Categoria
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategory("todas")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      category === "todas"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card-elevated text-muted-foreground border-border"
                    }`}
                  >
                    Todas
                  </button>
                  {allCategories.map((c) => {
                    const color = colorForCategory(c);
                    const active = category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5"
                        style={{
                          backgroundColor: active
                            ? `color-mix(in oklab, ${color} 22%, transparent)`
                            : "var(--color-card-elevated)",
                          borderColor: active ? color : "var(--color-border)",
                          color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Ordenar por
                </p>
                <div className="rounded-2xl bg-card-elevated border border-border divide-y divide-border overflow-hidden">
                  {(
                    [
                      { v: "recentes", label: "Mais recentes" },
                      { v: "antigos", label: "Mais antigos" },
                      { v: "maior", label: "Maior valor" },
                      { v: "menor", label: "Menor valor" },
                    ] as { v: Sort; label: string }[]
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => setSort(v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground"
                    >
                      {label}
                      {sort === v && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={clearAll}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold bg-card-elevated text-foreground border border-border"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold bg-primary text-primary-foreground"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
