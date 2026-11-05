import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useFinance, financeActions } from "@/lib/finance-store";
import { Target, Wallet, CreditCard, FileText, ChevronRight, LogOut, Trophy, MessageSquare, Gift, Flag, HelpCircle, LayoutGrid, Download, Sparkles, Mic, Trash2, AlertTriangle, Repeat, Bot, Landmark, ShieldCheck } from "lucide-react";
import { signOut } from "@/hooks/use-auth";
import { transactionsToCsv, downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import type { DashboardPrefs } from "@/lib/finance-store";
import { SandboxConnectButton } from "@/components/sandbox-reconnect";

export const Route = createFileRoute("/mais")({
  head: () => ({ meta: [{ title: "Mais — Finlux" }] }),
  component: Mais,
});

function Mais() {
  const state = useFinance();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await financeActions.resetAllData();
      setConfirmReset(false);
      toast.success("Todos os dados foram apagados.");
    } catch {
      toast.error("Não foi possível apagar os dados. Tente novamente.");
    } finally {
      setResetting(false);
    }
  }



  const groups = [
    {
      label: "Contas conectadas",
      items: [
        { to: "/open-finance", icon: Landmark, title: "Open Finance", desc: "Conecte instituições e consolide suas contas" },
        { to: "/open-finance/privacidade", icon: ShieldCheck, title: "Privacidade e segurança", desc: "Dados compartilhados e consentimentos" },
      ],
    },
    {
      label: "Inteligência Financeira",
      items: [
        { to: "/lux", icon: Bot, title: "Central do Lux IA", desc: "Evolução, vínculo e dicas do seu assessor" },
        { to: "/assessor", icon: Mic, title: "Meu Assessor", desc: "Registre por foto, áudio ou texto" },
        { to: "/assistente", icon: Sparkles, title: "Assistente IA", desc: "Insights e dicas com inteligência" },
        { to: "/relatorio", icon: FileText, title: "Relatório mensal", desc: "Receitas, despesas e insights" },
      ],
    },
    {
      label: "Planejamento",
      items: [
        { to: "/metas", icon: Target, title: "Metas", desc: "Acompanhe seus objetivos" },
        { to: "/desafios", icon: Flag, title: "Desafios", desc: "Missões mensais para hábitos" },
        { to: "/conquistas", icon: Trophy, title: "Conquistas", desc: "Sua sequência e medalhas" },
      ],
    },
    {
      label: "Patrimônio",
      items: [
        { to: "/patrimonio", icon: Wallet, title: "Patrimônio e investimentos", desc: "Bens, dívidas e simulador" },
        { to: "/parcelas", icon: CreditCard, title: "Compras parceladas", desc: "Controle as parcelas do cartão" },
        { to: "/recorrentes", icon: Repeat, title: "Contas recorrentes", desc: "Assinaturas e contas fixas do mês" },
      ],
    },
    {
      label: "Outros",
      items: [
        { to: "/indicar", icon: Gift, title: "Indicar amigos", desc: "Ganhe bônus por cada amigo" },
        { to: "/feedback", icon: MessageSquare, title: "Avaliar o Finlux", desc: "Conte como podemos melhorar" },
        { to: "/ajuda", icon: HelpCircle, title: "Ajuda e FAQ", desc: "Tire dúvidas rapidamente" },
      ],
    },
  ] as const;


  function exportCsv() {
    const csv = transactionsToCsv(state.transactions);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`finlux-transacoes-${date}.csv`, csv);
  }

  const dashSections: { key: keyof DashboardPrefs; label: string }[] = [
    { key: "showHealth", label: "Saúde financeira" },
    { key: "showTips", label: "Insights inteligentes" },
    { key: "showCategories", label: "Gastos por categoria" },
    { key: "showRecents", label: "Transações recentes" },
  ];

  return (
    <AppShell>
      <PageHeader subtitle="Tudo do app" title="Mais" />
      <div className="px-6 space-y-3">
        <SandboxConnectButton />
        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <h2 className="px-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              {group.label}
            </h2>
            {group.items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="flex items-center gap-4 rounded-3xl bg-card border border-border p-4 hover:border-primary transition-colors"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card-elevated text-primary">
                  <i.icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{i.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{i.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ))}

        <h2 className="px-1 pt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Configurações
        </h2>


        <section className="rounded-3xl bg-card border border-border p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Configurações de alertas
          </h2>
          <label className="block">
            <span className="text-xs text-muted-foreground">Renda mensal (R$)</span>
            <input
              type="number"
              defaultValue={state.monthlyIncome}
              onBlur={(e) => financeActions.setMonthlyIncome(Number(e.target.value) || 0)}
              className="mt-1 w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">
              Alertar quando parcelas passarem de {state.installmentAlertPct}% da renda
            </span>
            <input
              type="range"
              min={5}
              max={80}
              step={5}
              defaultValue={state.installmentAlertPct}
              onChange={(e) => financeActions.setInstallmentAlertPct(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-primary)]"
            />
          </label>
        </section>

        <section className="rounded-3xl bg-card border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Personalizar dashboard
            </h2>
          </div>
          {dashSections.map((s) => (
            <label key={s.key} className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">{s.label}</span>
              <input
                type="checkbox"
                checked={state.dashboardPrefs[s.key]}
                onChange={() => financeActions.toggleDashboardSection(s.key)}
                className="h-5 w-5 accent-[var(--color-primary)]"
              />
            </label>
          ))}
        </section>

        <button
          onClick={exportCsv}
          className="w-full rounded-3xl bg-card border border-border p-4 flex items-center gap-3 text-foreground hover:border-primary transition-colors"
        >
          <Download className="h-5 w-5 text-primary" />
          <span className="font-bold">Exportar transações (CSV)</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {state.transactions.length}
          </span>
        </button>

        <button
          onClick={() => setConfirmReset(true)}
          className="w-full rounded-3xl bg-card border border-border p-4 flex items-center gap-3 text-destructive hover:border-destructive transition-colors"
        >
          <Trash2 className="h-5 w-5" />
          <span className="font-bold">Apagar dados</span>
          <span className="ml-auto text-xs text-muted-foreground">Reset completo</span>
        </button>

        <button
          onClick={() => signOut()}
          className="w-full rounded-3xl bg-card border border-border p-4 flex items-center gap-3 text-destructive hover:border-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-bold">Sair</span>
        </button>
      </div>

      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-200"
          onClick={() => !resetting && setConfirmReset(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-foreground">
                Tem certeza? Após confirmação todos os dados serão deletados.
              </h2>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="py-3 rounded-2xl text-sm font-bold bg-card-elevated text-foreground border border-border disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="py-3 rounded-2xl text-sm font-bold bg-destructive text-destructive-foreground disabled:opacity-50"
              >
                {resetting ? "Apagando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}