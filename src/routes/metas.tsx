import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, financeActions } from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/metas")({
  head: () => ({ meta: [{ title: "Metas — Finlux" }] }),
  component: Metas,
});

function Metas() {
  const state = useFinance();
  const [open, setOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader subtitle="Objetivos" title="Metas" />
      <div className="px-6 space-y-4">
        {state.goals.map((g) => {
          const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
          const days = Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          return (
            <div key={g.id} className="rounded-3xl bg-card border border-border p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 rounded-2xl bg-card-elevated flex items-center justify-center text-2xl">
                    {g.emoji}
                  </span>
                  <div>
                    <p className="font-bold text-foreground">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{days} dias restantes</p>
                  </div>
                </div>
                <button
                  onClick={() => financeActions.removeGoal(g.id)}
                  aria-label="Remover meta"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-baseline justify-between tabular-nums">
                <span className="text-lg font-bold text-foreground">{formatBRL(g.saved)}</span>
                <span className="text-sm text-muted-foreground">de {formatBRL(g.target)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">{pct}% concluído</span>
                <button
                  className="text-xs font-semibold text-foreground bg-card-elevated rounded-full px-3 py-1.5"
                  onClick={() => {
                    const v = prompt("Adicionar valor (R$):");
                    if (v) financeActions.contributeGoal(g.id, Number(v));
                  }}
                >
                  + Aportar
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl border-2 border-dashed border-border py-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
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
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-12 rounded-full bg-muted mx-auto" />
        <h2 className="text-xl font-bold">Nova meta</h2>
        <div className="flex gap-2">
          {["🎯", "✈️", "🏠", "🚗", "💍", "🎓", "🛟", "💻"].map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`h-11 w-11 rounded-2xl text-xl flex items-center justify-center ${
                emoji === e ? "bg-primary text-primary-foreground" : "bg-card-elevated"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
          placeholder="Nome da meta"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none"
            placeholder="Valor alvo"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <input
            type="number"
            className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none"
            placeholder="Já guardado"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold"
          onClick={() => {
            if (!title || !target) return;
            financeActions.addGoal({
              title,
              emoji,
              target: Number(target),
              saved: Number(saved) || 0,
              deadline: new Date(deadline).toISOString(),
            });
            onClose();
          }}
        >
          Criar meta
        </button>
      </div>
    </div>
  );
}