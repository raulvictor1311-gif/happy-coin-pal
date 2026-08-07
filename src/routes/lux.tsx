import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ChevronRight,
  Flame,
  Lock,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LuxAvatar } from "@/components/lux/lux-avatar";
import { LuxBubble } from "@/components/lux/lux-bubble";
import { useFinance } from "@/lib/finance-store";
import { LUX_RANKS, luxBond, luxGreeting, luxPhrase, luxRank } from "@/lib/lux";
import type { LuxEmotion, LuxPhraseCategory } from "@/lib/lux";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/lux")({
  head: () => ({
    meta: [
      { title: "Central do Lux IA — Finlux" },
      {
        name: "description",
        content:
          "Acompanhe a evolução do Lux IA, seu assessor financeiro: nível, vínculo, sequência de registros e dicas personalizadas.",
      },
      { property: "og:title", content: "Central do Lux IA — Finlux" },
      {
        property: "og:description",
        content: "Nível, vínculo e dicas do seu assessor financeiro Lux IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LuxCentral;
});

const DAILY: { category: LuxPhraseCategory; emotion: LuxEmotion; label: string }[] = [
  { category: "educacao", emotion: "professor", label: "Educação financeira" },
  { category: "motivacao", emotion: "motivando", label: "Motivação do dia" },
  { category: "investimento", emotion: "investindo", label: "Sobre investir" },
  { category: "seguranca", emotion: "seguranca", label: "Segurança" },
];

function LuxCentral() {
  const state = useFinance();
  const { session } = useAuth();
  const name =
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    session?.user?.email?.split("@")[0] ??
    null;

  const bond = luxBond(state);
  const { rank, next, level, xp, nextXp } = luxRank(state);
  const greeting = luxGreeting(state, name);
  const progress = nextXp > 0 ? Math.min(100, Math.round((xp / nextXp) * 100)) : 100;
  const seed = useMemo(() => bond.daysTogether + bond.records, [bond.daysTogether, bond.records]);

  return (
    <AppShell>
      <PageHeader subtitle="Lux IA" title="Central do Lux" />

      <div className="px-6 space-y-4">
        <div className="card-premium rounded-3xl p-5">
          <div className="flex flex-col items-center text-center">
            <LuxAvatar emotion={greeting.emotion} size={104} />
            <span className="mt-3 rounded-full bg-card-elevated border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {rank.name}
            </span>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{greeting.text}</p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Nível {level} · {xp}/{nextXp} XP
              </span>
              <span>{next ? `Próximo: ${next.name}` : "Nível máximo"}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-card-elevated">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Sparkles} label="Dias juntos" value={String(bond.daysTogether)} />
          <Stat icon={Flame} label="Sequência" value={`${bond.streak} d`} />
          <Stat icon={Trophy} label="Score financeiro" value={`${bond.score}/100`} />
          <Stat icon={TrendingUp} label="Patrimônio" value={formatBRL(bond.netWorth)} />
        </div>

        <LuxBubble emotion="dica">{luxPhrase("educacao", seed)}</LuxBubble>

        <section className="rounded-3xl bg-card border border-border p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Evolução do Lux
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span className="font-bold">
              {LUX_RANKS.filter((r) => level >= r.minLevel).length}
            </span>{" "}
            de {LUX_RANKS.length} formas desbloqueadas
          </p>

          <ul className="mt-4 space-y-3">
            {LUX_RANKS.map((r) => {
              const unlocked = level >= r.minLevel;
              return (
                <li
                  key={r.key}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    r.key === rank.key
                      ? "border-primary bg-card-elevated"
                      : unlocked
                        ? "border-border bg-card-elevated"
                        : "border-border bg-card opacity-70"
                  }`}
                >
                  {unlocked ? (
                    <LuxAvatar
                      emotion={r.key === "lendario" ? "comemorando" : "feliz"}
                      size={40}
                      particles={false}
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-elevated border border-border">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                      {r.key === rank.key && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{r.unlocks}</p>
                    {!unlocked && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Desbloqueia no nível {r.minLevel}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-3xl bg-card border border-border p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            O Lux ensinando
          </p>
          <div className="mt-4 space-y-3">
            {DAILY.map((d, i) => (
              <div
                key={d.category}
                className="flex items-start gap-3 rounded-2xl bg-card-elevated border border-border p-4"
              >
                <LuxAvatar emotion={d.emotion} size={36} particles={false} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {d.label}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground leading-snug">
                    {luxPhrase(d.category, seed + i)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/assistente"
          className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform glow-primary"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversar com o Lux
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-1.5 text-lg font-bold text-foreground truncate">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
    </div>
  );
}
