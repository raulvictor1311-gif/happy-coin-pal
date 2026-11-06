import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, getAchievements, getStreak, getLevel } from "@/lib/finance-store";
import { Flame, Trophy } from "lucide-react";


export const Route = createFileRoute("/conquistas")({
  head: () => finluxMeta('Conquistas — Finlux', 'Veja conquistas e hábitos financeiros reconhecidos pelo Finlux.'),
  component: Conquistas,
});

function Conquistas() {
  const state = useFinance();
  const achievements = getAchievements(state);
  const streak = getStreak(state);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const level = getLevel(state);
  const xpPct = Math.min(100, (level.xp / level.nextXp) * 100);

  return (
    <AppShell>
      <PageHeader subtitle="Gamificação" title="Conquistas" />
      <div className="px-6 space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-card to-card-elevated border border-border p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-card-elevated flex items-center justify-center text-[var(--color-warning)]">
              <Trophy className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nível {level.level}</p>
              <p className="text-2xl font-bold text-foreground">{level.title}</p>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">{level.xp}/{level.nextXp} XP</p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        <div className="rounded-3xl bg-card border border-border p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-card-elevated flex items-center justify-center">
            <Flame className="h-7 w-7 text-[var(--color-warning)]" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sequência</p>
            <p className="text-2xl font-bold text-foreground">{streak} {streak === 1 ? "dia" : "dias"}</p>
            <p className="text-xs text-muted-foreground">Registre algo hoje para manter a chama acesa.</p>
          </div>
        </div>


        <div className="rounded-3xl bg-card border border-border p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
            Medalhas
          </p>
          <p className="text-sm text-foreground mb-4">
            <span className="font-bold">{unlocked}</span> de {achievements.length} desbloqueadas
          </p>
          <div className="grid grid-cols-1 gap-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 flex gap-3 items-start ${
                  a.unlocked ? "border-primary bg-card-elevated" : "border-border bg-card opacity-80"
                }`}
              >
                <div className="text-3xl">{a.unlocked ? a.emoji : "🔒"}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  {typeof a.progress === "number" && !a.unlocked && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(2, Math.min(100, a.progress))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
