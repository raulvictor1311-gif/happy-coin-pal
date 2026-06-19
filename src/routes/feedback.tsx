import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, financeActions } from "@/lib/finance-store";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Finlux" }] }),
  component: Feedback,
});

function Feedback() {
  const state = useFinance();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (score === null) return;
    financeActions.addFeedback(score, comment || undefined);
    setSent(true);
    setScore(null);
    setComment("");
  };

  return (
    <AppShell>
      <PageHeader subtitle="Sua opinião" title="Avaliar o Finlux" />
      <div className="px-6 space-y-4">
        <div className="rounded-3xl bg-card border border-border p-5">
          <p className="text-sm text-foreground">
            Em uma escala de 0 a 10, qual a chance de você indicar o Finlux a um amigo?
          </p>
          <div className="mt-4 grid grid-cols-11 gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                className={`aspect-square rounded-lg text-sm font-bold border ${
                  score === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card-elevated text-foreground border-border"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="O que poderia melhorar? (opcional)"
            rows={3}
            className="mt-4 w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary resize-none"
          />
          <button
            onClick={submit}
            disabled={score === null}
            className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-bold disabled:opacity-50"
          >
            Enviar avaliação
          </button>
          {sent && (
            <p className="mt-3 text-center text-sm text-[var(--color-success)]">
              Obrigado! Sua opinião ajuda o Finlux a melhorar.
            </p>
          )}
        </div>

        {state.feedback.length > 0 && (
          <div className="rounded-3xl bg-card border border-border p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
              Suas avaliações anteriores
            </p>
            <ul className="space-y-2">
              {state.feedback.slice(0, 5).map((f) => (
                <li key={f.id} className="flex justify-between text-sm">
                  <span className="text-foreground">Nota {f.score}</span>
                  <span className="text-muted-foreground">
                    {new Date(f.date).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
