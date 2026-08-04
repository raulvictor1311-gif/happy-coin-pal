import { Link } from "@tanstack/react-router";
import { Flame, Sparkles, TrendingUp, ChevronRight } from "lucide-react";
import { LuxAvatar } from "@/components/lux/lux-avatar";
import { useFinance } from "@/lib/finance-store";
import { luxBond, luxGreeting, luxPhrase, luxRank } from "@/lib/lux";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

/**
 * Central do Lux — cartão de relacionamento no dashboard.
 * Puramente apresentacional: lê o estado financeiro existente.
 */
export function LuxCard({ hideValues = false }: { hideValues?: boolean }) {
  const state = useFinance();
  const { session } = useAuth();
  const name =
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    (session?.user?.user_metadata?.name as string | undefined) ??
    session?.user?.email?.split("@")[0] ??
    null;

  const greeting = luxGreeting(state, name);
  const bond = luxBond(state);
  const { rank, next, level, xp, nextXp } = luxRank(state);
  const progress = nextXp > 0 ? Math.min(100, Math.round((xp / nextXp) * 100)) : 100;

  return (
    <section className="px-6 mt-5">
      <div className="card-premium rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <LuxAvatar emotion={greeting.emotion} size={68} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Lux IA</h2>
              <span className="rounded-full bg-card-elevated border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {rank.name.replace("Lux ", "")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground leading-snug">{greeting.text}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Dias juntos" value={String(bond.daysTogether)} icon={Sparkles} />
          <Stat label="Sequência" value={`${bond.streak}d`} icon={Flame} />
          <Stat
            label="Patrimônio"
            value={hideValues ? "•••" : formatBRL(bond.netWorth)}
            icon={TrendingUp}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Nível {level}</span>
            <span>{next ? `Próximo: ${next.name}` : "Nível máximo"}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card-elevated">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground italic leading-snug">
          “{luxPhrase("educacao", bond.daysTogether)}”
        </p>

        <Link
          to="/assistente"
          className="mt-4 flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] transition-transform glow-primary"
        >
          Conversar com o Lux
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-2xl bg-card-elevated border border-border px-3 py-2.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <p className="mt-1 text-sm font-bold text-foreground truncate">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
    </div>
  );
}
