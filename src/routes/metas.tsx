import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, financeActions } from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Target, TrendingUp, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/metas")({
  head: () => finluxMeta('Metas — Finlux', 'Acompanhe suas metas financeiras e valores reservados.'),
  component: Metas,
});

const EMOJI_OPTIONS = ["🎯", "✈️", "🏠", "🚗", "💍", "🎓", "🛟", "💻", "📱", "🏖️", "🎮", "🚲"];

function Metas() {
  const state = useFinance();
  const [open, setOpen] = useState(false);
  // Estado de carregamento real, vindo da sincronização com a nuvem.
  const loading = state.cloudLoading;



  const stats = useMemo(() => {
    const totalTarget = state.goals.reduce((a, g) => a + g.target, 0);
    const totalSaved = state.goals.reduce((a, g) => a + g.saved, 0);
    const pct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    return { totalTarget, totalSaved, pct, count: state.goals.length };
  }, [state.goals]);

  return (
    <AppShell>
      <PageHeader subtitle="Objetivos" title="Metas" />

      <div className="px-6 space-y-4 pb-6">
        {/* Summary */}
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Progresso geral
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {formatBRL(stats.totalSaved)}
              </p>
              <p className="text-xs text-muted-foreground">
                de {formatBRL(stats.totalTarget)} em {stats.count} {stats.count === 1 ? "meta" : "metas"}
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Target className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-700"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">{stats.pct}% concluído</p>
        </div>

        {/* Goals */}
        {loading ? (
          <>
            <Skeleton className="h-44 w-full rounded-3xl" />
            <Skeleton className="h-44 w-full rounded-3xl" />
          </>
        ) : state.goals.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center animate-in fade-in duration-300">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-semibold">Nenhuma meta ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crie sua primeira meta e comece a economizar com propósito.
            </p>
          </div>
        ) : (
          state.goals.map((g, idx) => {
            const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
            const days = Math.max(
              0,
              Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            );
            const remaining = Math.max(0, g.target - g.saved);
            const perMonth = days > 0 ? remaining / Math.max(1, days / 30) : 0;
            return (
              <div
                key={g.id}
                className="rounded-3xl bg-card border border-border p-5 animate-in fade-in slide-in-from-bottom-1 duration-300"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-12 w-12 rounded-2xl bg-card-elevated flex items-center justify-center text-2xl shrink-0">
                      {g.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{g.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {days > 0 ? `${days} dias restantes` : "Prazo encerrado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      financeActions.removeGoal(g.id);
                      toast.success("Meta removida.");
                    }}
                    aria-label="Remover meta"
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-baseline justify-between tabular-nums">
                  <span className="text-lg font-bold text-foreground">{formatBRL(g.saved)}</span>
                  <span className="text-sm text-muted-foreground">de {formatBRL(g.target)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">{pct}% concluído</span>
                  {perMonth > 0 && pct < 100 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {formatBRL(perMonth)}/mês
                    </span>
                  )}
                </div>

                <button
                  className="mt-4 w-full rounded-2xl bg-card-elevated hover:bg-muted transition-colors py-2.5 text-sm font-semibold text-foreground"
                  onClick={() => {
                    const v = prompt("Adicionar valor (R$):");
                    if (v === null) return;
                    const n = Number(v.replace(",", "."));
                    if (Number.isNaN(n) || n <= 0) {
                      toast.error("Informe um valor maior que zero.");
                      return;
                    }
                    financeActions.contributeGoal(g.id, n);
                    toast.success(`Aporte de ${formatBRL(n)} registrado.`);
                  }}
                >
                  + Aportar
                </button>
              </div>
            );
          })
        )}

        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border-2 border-dashed border-border py-5 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
        >
          <Plus className="h-5 w-5" /> Nova meta
        </button>
      </div>

      {open && <AddGoal onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

function AddGoal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("0");
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Nova meta</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="h-9 w-9 rounded-full bg-card-elevated flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Ícone
          </p>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-11 w-11 rounded-2xl text-xl flex items-center justify-center transition-colors ${
                  emoji === e ? "bg-primary text-primary-foreground" : "bg-card-elevated hover:bg-muted"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <input
          className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary transition-shadow"
          placeholder="Nome da meta"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            inputMode="decimal"
            className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary transition-shadow"
            placeholder="Valor alvo"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <input
            type="number"
            inputMode="decimal"
            className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary transition-shadow"
            placeholder="Já guardado"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary transition-shadow"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          disabled={!title || !target}
          onClick={() => {
            if (!title.trim()) {
              toast.error("Dê um nome para a meta.");
              return;
            }
            const targetValue = Number(target);
            if (!target || Number.isNaN(targetValue) || targetValue <= 0) {
              toast.error("O valor alvo deve ser maior que zero.");
              return;
            }
            const savedValue = Number(saved) || 0;
            if (savedValue < 0) {
              toast.error("O valor já guardado não pode ser negativo.");
              return;
            }
            financeActions.addGoal({
              title: title.trim(),
              emoji,
              target: targetValue,
              saved: savedValue,
              deadline: new Date(deadline).toISOString(),
            });
            toast.success("Meta criada com sucesso.");
            onClose();
          }}
        >
          Criar meta
        </button>
      </div>
    </div>
  );
}
