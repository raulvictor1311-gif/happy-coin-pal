import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  MessageCircle,
  PlusCircle,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LuxAvatar } from "@/components/lux/lux-avatar";
import { LuxBubble } from "@/components/lux/lux-bubble";
import { financeActions } from "@/lib/finance-store";
import type { LuxEmotion } from "@/lib/lux";

type Step = {
  emotion: LuxEmotion;
  speech: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

/** Onboarding conduzido pelo Lux IA — apresenta o app em 4 passos curtos. */
export function LuxOnboarding({ name }: { name: string }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      emotion: "feliz",
      speech: `Oi, ${name}! Eu sou o Lux, seu assessor financeiro. Vou te acompanhar em cada decisão de dinheiro.`,
      title: "Prazer, sou o Lux IA",
      desc: "Analiso seus lançamentos, encontro desperdícios e te aviso antes de qualquer aperto.",
      icon: Sparkles,
    },
    {
      emotion: "planejando",
      speech: "Comece registrando uma receita ou despesa. Leva menos de 10 segundos.",
      title: "Registre seus lançamentos",
      desc: "Dinheiro, Pix, débito ou crédito parcelado — eu organizo tudo e cuido das faturas.",
      icon: PlusCircle,
    },
    {
      emotion: "motivando",
      speech: "Depois crie uma meta. Ter um objetivo claro muda completamente o resultado.",
      title: "Defina uma meta",
      desc: "Eu calculo quanto guardar por mês e comemoro com você a cada avanço.",
      icon: Target,
    },
    {
      emotion: "dica",
      speech: "E pode falar comigo quando quiser — até pelo WhatsApp. Bora começar?",
      title: "Converse comigo",
      desc: "Pergunte sobre gastos, simule compras ou envie fotos de comprovantes.",
      icon: MessageCircle,
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  const close = () => {
    financeActions.completeOnboarding();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 relative animate-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={close}
          aria-label="Pular apresentação"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex justify-center pt-2">
          <LuxAvatar emotion={current.emotion} size={96} />
        </div>

        <LuxBubble emotion={current.emotion} size={0} className="mt-4">
          {current.speech}
        </LuxBubble>

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-card-elevated border border-border p-4">
          <current.icon className="h-5 w-5 shrink-0 text-[var(--color-primary)] mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">{current.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{current.desc}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.title}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                background:
                  i === step
                    ? "var(--color-primary)"
                    : "color-mix(in oklab, var(--color-muted-foreground) 40%, transparent)",
              }}
            />
          ))}
        </div>

        {last ? (
          <Link
            to="/nova"
            onClick={close}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98] transition-transform"
          >
            Registrar primeira transação
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98] transition-transform"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={close}
          className="mt-2 w-full rounded-2xl bg-card-elevated py-3 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
        >
          {last ? "Explorar primeiro" : "Pular apresentação"}
        </button>
      </div>
    </div>
  );
}
