import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ChevronDown } from "lucide-react";

export const Route = createFileRoute("/ajuda")({
  head: () => finluxMeta('Ajuda — Finlux', 'Respostas sobre lançamentos, parcelas, patrimônio e uso do Finlux.'),
  component: Ajuda,
});

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como registrar uma receita ou despesa?",
    a: 'Vá em "Nova" no menu inferior, escolha o tipo (receita ou despesa), preencha valor, categoria e data, e salve.',
  },
  {
    q: "Os meus dados ficam seguros?",
    a: "Suas informações ficam armazenadas localmente no aparelho e na sua conta. Use o cadeado de saldo para esconder valores em telas públicas.",
  },
  {
    q: "Como funciona o controle de parcelas?",
    a: 'Em "Mais → Compras parceladas", registre uma compra com o número de parcelas. O app calcula as parcelas futuras, mostra o impacto na fatura e no patrimônio.',
  },
  {
    q: "Como acompanho meu patrimônio?",
    a: 'Em "Mais → Patrimônio" você cadastra contas, investimentos, veículos, imóveis, dívidas. O patrimônio líquido é calculado automaticamente.',
  },
  {
    q: "O que são os desafios e conquistas?",
    a: "São formas de gamificação para manter você consistente. A cada hábito financeiro saudável você sobe de nível e desbloqueia medalhas.",
  },
  {
    q: "Como esqueço de pagar uma parcela?",
    a: 'Configure em "Mais" o alerta de parcelas. Você recebe uma notificação quando as parcelas passarem da % escolhida da sua renda.',
  },
];

function Ajuda() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <AppShell>
      <PageHeader subtitle="Central de ajuda" title="Como podemos ajudar?" />
      <div className="px-6 space-y-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <span className="text-sm font-semibold text-foreground">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              )}
            </div>
          );
        })}
        <div className="mt-6 rounded-3xl bg-card border border-border p-5 text-center">
          <p className="text-sm text-foreground font-bold">Não encontrou o que procura?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Escreva para <span className="text-primary">ajuda@finlux.app</span> que respondemos em até 24h.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
