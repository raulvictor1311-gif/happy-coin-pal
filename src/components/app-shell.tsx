import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Receipt, CreditCard, Plus, MoreHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PlusMenu } from "@/components/plus-menu";
import { OpenFinanceNotice } from "@/components/open-finance-notice";

const tabs = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/extrato", icon: Receipt, label: "Extrato" },
  { to: "/cartoes", icon: CreditCard, label: "Cartões" },
  { to: "/mais", icon: MoreHorizontal, label: "Mais" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [plusOpen, setPlusOpen] = useState(false);
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  if (!loading && !session) return null;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md min-h-screen pb-32 animate-in fade-in duration-300">
        <OpenFinanceNotice />
        {children}
      </div>
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(28rem,calc(100%-1.5rem))] z-40">
        <div className="relative flex items-center justify-between rounded-full bg-card-elevated/95 backdrop-blur border border-border px-3 py-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
          {tabs.slice(0, 2).map((t) => (
            <TabLink key={t.to} {...t} active={pathname === t.to} />
          ))}
          <button
            type="button"
            onClick={() => setPlusOpen(true)}
            aria-label="Adicionar transação"
            className="flex h-14 w-14 -mt-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-4px_color-mix(in_oklab,var(--color-primary)_60%,transparent)] active:scale-95 transition-transform"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
          {tabs.slice(2).map((t) => (
            <TabLink key={t.to} {...t} active={pathname === t.to} />
          ))}
        </div>
      </nav>
      <PlusMenu open={plusOpen} onClose={() => setPlusOpen(false)} />
    </div>
  );
}

function TabLink({ to, icon: Icon, label, active }: { to: string; icon: typeof Home; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-semibold tracking-wider">{label.toUpperCase()}</span>
      {active && (
        <span className="absolute -top-1 h-1 w-1 rounded-full bg-primary glow-primary animate-in fade-in zoom-in duration-300" />
      )}
    </Link>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-6 pt-10 pb-6">
      {subtitle && (
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p>
      )}
      <h1 className="mt-1 text-3xl font-bold text-foreground">{title}</h1>
    </header>
  );
}