import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type FinanceState } from "@/lib/finance-store";
import { buildFinanceContext } from "@/lib/finance-ai";

type Tone = "positive" | "warning" | "neutral";
type Insight = { title: string; detail: string; tone: Tone };

const toneStyles: Record<Tone, { color: string; Icon: typeof Sparkles }> = {
  positive: { color: "var(--color-success)", Icon: TrendingUp },
  warning: { color: "var(--color-warning)", Icon: AlertTriangle },
  neutral: { color: "var(--color-primary)", Icon: Lightbulb },
};

export function AiInsights({ state }: { state: FinanceState }) {
  const context = useMemo(() => buildFinanceContext(state), [state]);
  const hasData = state.transactions.length > 0;
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ context }),
      });
      if (res.status === 429) {
        setError("Muitas solicitações. Tente novamente em instantes.");
        return;
      }
      if (res.status === 402) {
        setError("Créditos de IA esgotados.");
        return;
      }
      if (!res.ok) {
        setError("Não foi possível gerar os insights agora.");
        return;
      }
      const json = (await res.json()) as { insights?: Insight[] };
      setInsights(Array.isArray(json.insights) ? json.insights.slice(0, 4) : []);
    } catch {
      setError("Não foi possível gerar os insights agora.");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (!hasData || fetchedRef.current) return;
    fetchedRef.current = true;
    void load();
  }, [hasData, load]);

  if (!hasData) return null;

  return (
    <section className="px-6 mt-5">
      <div className="rounded-3xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold truncate">
              Insights com IA
            </h2>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            aria-label="Atualizar insights"
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && insights.length === 0 && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-2xl bg-card-elevated shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/3 rounded-full bg-card-elevated" />
                  <div className="h-3 w-4/5 rounded-full bg-card-elevated" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => void load()} className="mt-2 text-sm font-semibold text-primary">
              Tentar novamente
            </button>
          </div>
        )}

        {insights.length > 0 && (
          <ul className="space-y-3">
            {insights.map((ins, i) => {
              const { color, Icon } = toneStyles[ins.tone] ?? toneStyles.neutral;
              return (
                <li key={i} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <span
                    className="h-8 w-8 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{ins.title}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{ins.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && insights.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Toque em atualizar para gerar seus insights.
          </p>
        )}
      </div>
    </section>
  );
}
