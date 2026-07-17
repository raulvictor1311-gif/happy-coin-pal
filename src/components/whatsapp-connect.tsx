import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Loader2, Check, Copy, Smartphone, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getWhatsappLink,
  registerWhatsapp,
  removeWhatsapp,
} from "@/lib/whatsapp.functions";
import {
  ADVISOR_CONFIGURED,
  advisorDisplayNumber,
  advisorWhatsappLink,
} from "@/lib/advisor";
import { clearLocalReconnect } from "@/lib/twilio-sandbox";

/** Seção "Enviar código para o Assessor" — exibe o número e abre o WhatsApp. */
export function AdvisorContact({ code }: { code?: string }) {
  if (!ADVISOR_CONFIGURED) {
    // Estado de erro: contato não configurado.
    if (typeof console !== "undefined") {
      console.error("VITE_ADVISOR_WHATSAPP não configurado: contato do assessor indisponível.");
    }
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <p className="text-xs font-semibold text-destructive">
          Contato do assessor indisponível no momento.
        </p>
      </div>
    );
  }

  const message = code
    ? `Olá! Quero vincular meu WhatsApp ao Finlux. Meu código é ${code}.`
    : "Olá! Quero registrar meus gastos com o Finlux.";

  return (
    <div className="rounded-2xl bg-card-elevated p-3 space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">Enviar código para o Assessor</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Envie o código recebido para o número abaixo via WhatsApp para concluir a vinculação
          com seu assessor.
        </p>
      </div>
      <div className="rounded-xl bg-card border border-border px-4 py-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Número do Assessor
        </p>
        <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
          {advisorDisplayNumber()}
        </p>
      </div>
      <a
        href={advisorWhatsappLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-2xl bg-[#25D366] text-white font-bold py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <MessageCircle className="h-4 w-4" /> Conversar no WhatsApp
      </a>
    </div>
  );
}


function formatPhone(digits: string): string {
  // 5511999999999 -> +55 11 99999-9999 (melhor esforço)
  if (digits.length >= 12) {
    const ddi = digits.slice(0, digits.length - 11);
    const ddd = digits.slice(-11, -9);
    const part1 = digits.slice(-9, -4);
    const part2 = digits.slice(-4);
    return `+${ddi} ${ddd} ${part1}-${part2}`;
  }
  return `+${digits}`;
}

export function WhatsappConnect() {
  const fetchLink = useServerFn(getWhatsappLink);
  const register = useServerFn(registerWhatsapp);
  const remove = useServerFn(removeWhatsapp);

  const { data: link, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-link"],
    queryFn: () => fetchLink(),
  });

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  // O código em texto puro é retornado pelo servidor apenas uma vez, no momento
  // da geração. Mantemos localmente para exibir enquanto o usuário confirma.
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  async function handleConnect(existingPhone?: string) {
    const target = (existingPhone ?? phone).trim();
    if (!target) {
      toast.error("Digite seu número de WhatsApp com DDD.");
      return;
    }
    setSaving(true);
    try {
      const res = await register({ data: { phone: target } });
      setPendingCode(res.verification_code);
      await refetch();
      if (!existingPhone) setPhone("");
      toast.success("Código gerado! Envie pelo WhatsApp em até 10 minutos.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui registrar o número.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await remove({});
      clearLocalReconnect();
      await refetch();
      toast.success("WhatsApp desconectado.");
    } catch {
      toast.error("Não consegui desconectar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Registrar pelo WhatsApp</h2>
          <p className="text-xs text-muted-foreground">
            Conecte seu número e registre gastos por mensagem, foto ou áudio.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : link?.verified ? (
        <div className="rounded-2xl bg-card-elevated p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-6 w-6 rounded-full bg-green-500/15 flex items-center justify-center">
              <Check className="h-4 w-4 text-green-500" />
            </span>
            WhatsApp conectado
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            {formatPhone(link.phone)}
          </div>
          <div className="rounded-xl bg-card border border-border p-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">Comandos no WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              Envie <strong>saldo</strong>, <strong>resumo</strong> ou <strong>ajuda</strong> a
              qualquer momento — ou mande texto, foto e áudio para registrar gastos.
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={saving}
            className="flex items-center gap-2 text-xs font-semibold text-destructive disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" /> Desconectar número
          </button>
        </div>
      ) : link && !link.verified ? (
        <div className="rounded-2xl bg-card-elevated p-3 space-y-3">
          <p className="text-sm text-foreground">
            Quase lá! Envie o código abaixo pelo <strong>WhatsApp</strong> para o número do
            Finlux para confirmar <strong>{formatPhone(link.phone)}</strong>.
          </p>
          {link.verification_code && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link.verification_code!);
                toast.success("Código copiado!");
              }}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-primary/10 py-3 text-2xl font-bold tracking-[0.3em] text-primary"
            >
              {link.verification_code}
              <Copy className="h-4 w-4" />
            </button>
          )}
          <AdvisorContact code={link.verification_code ?? undefined} />
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="flex-1 rounded-2xl bg-card py-2.5 text-xs font-semibold text-foreground border border-border"
            >
              Já confirmei
            </button>
            <button
              onClick={handleRemove}
              disabled={saving}
              className="flex-1 rounded-2xl bg-card py-2.5 text-xs font-semibold text-muted-foreground border border-border disabled:opacity-60"
            >
              Trocar número
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            inputMode="tel"
            className="w-full bg-card-elevated rounded-2xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
          />
          <button
            onClick={handleConnect}
            disabled={saving}
            className="w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Conectar WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
