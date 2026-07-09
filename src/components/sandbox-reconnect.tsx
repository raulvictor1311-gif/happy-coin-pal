import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Loader2, Clock, ShieldCheck, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { getWhatsappLink } from "@/lib/whatsapp.functions";
import {
  IS_TWILIO_SANDBOX,
  SANDBOX_NUMBER_CONFIGURED,
  computeSandboxStatus,
  markLocalReconnect,
  sandboxJoinLink,
  type SandboxStatus,
} from "@/lib/twilio-sandbox";

/**
 * Hook central: lê o vínculo do WhatsApp e calcula o status do Sandbox.
 * Revalida automaticamente quando o app volta ao foco (usuário retorna após
 * enviar "join column-package" no WhatsApp) — fechando o modal sozinho.
 */
export function useSandboxStatus() {
  const fetchLink = useServerFn(getWhatsappLink);
  const query = useQuery({
    queryKey: ["whatsapp-link"],
    queryFn: () => fetchLink(),
    enabled: IS_TWILIO_SANDBOX,
    // Recalcula periodicamente para o contador/lembrete reagirem sozinhos.
    refetchInterval: IS_TWILIO_SANDBOX ? 60_000 : false,
  });

  const [status, setStatus] = useState<SandboxStatus>(() =>
    computeSandboxStatus(query.data?.sandbox_connected_at),
  );

  // Recalcula sempre que os dados mudarem ou a cada minuto (relógio).
  useEffect(() => {
    setStatus(computeSandboxStatus(query.data?.sandbox_connected_at));
    const id = setInterval(
      () => setStatus(computeSandboxStatus(query.data?.sandbox_connected_at)),
      60_000,
    );
    return () => clearInterval(id);
  }, [query.data?.sandbox_connected_at]);

  // Ao retornar ao app, revalida a conexão automaticamente.
  useEffect(() => {
    if (!IS_TWILIO_SANDBOX) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") query.refetch();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    link: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isVerified: Boolean(query.data?.verified),
  };
}

/** Abre o WhatsApp com "join column-package" e marca a reconexão localmente. */
export function openSandboxReconnect() {
  markLocalReconnect();
  const link = sandboxJoinLink();
  if (link) window.open(link, "_blank", "noopener,noreferrer");
}

/** Botão grande verde padrão WhatsApp. */
function ReconnectButton({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-2xl bg-[#25D366] text-white font-bold py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/30 active:scale-[0.98] transition-transform disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
      {label}
    </button>
  );
}

/**
 * Modal + lembrete preventivo da reconexão do Sandbox.
 * Renderiza apenas quando IS_TWILIO_SANDBOX e o número já foi verificado.
 */
export function SandboxReconnect() {
  const { status, isVerified } = useSandboxStatus();
  const [checking, setChecking] = useState(false);
  const [dismissedSoon, setDismissedSoon] = useState(false);
  const { refetch } = useSandboxStatus();

  if (!IS_TWILIO_SANDBOX || !SANDBOX_NUMBER_CONFIGURED || !isVerified) return null;

  async function handleReconnect() {
    openSandboxReconnect();
    // Dá um tempo para o usuário voltar e revalida.
    setChecking(true);
    setTimeout(async () => {
      await refetch();
      setChecking(false);
    }, 2500);
  }

  async function handleAlreadyDone() {
    setChecking(true);
    try {
      await refetch();
      const fresh = computeSandboxStatus(null);
      if (fresh.connected || status.connected) {
        toast.success("WhatsApp reconectado! 💜");
      } else {
        toast.info("Ainda não detectei a reconexão. Envie a mensagem no WhatsApp e tente de novo.");
      }
    } finally {
      setChecking(false);
    }
  }

  // Lembrete discreto: faltando menos de 12h.
  if (status.expiringSoon && !dismissedSoon) {
    return (
      <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-3">
        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Sua conexão com o WhatsApp expirará em breve
          </p>
          <p className="text-xs text-muted-foreground">
            {status.hoursRemaining != null
              ? `Faltam ~${status.hoursRemaining}h. Renove para não perder o Assistente.`
              : "Renove para não perder o Assistente."}
          </p>
        </div>
        <button
          onClick={handleReconnect}
          className="shrink-0 rounded-xl bg-[#25D366] text-white text-xs font-bold px-3 py-2 active:scale-95 transition-transform"
        >
          Renovar Agora
        </button>
        <button
          onClick={() => setDismissedSoon(true)}
          className="shrink-0 text-muted-foreground p-1"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Modal de reconexão: expirou.
  if (status.expired) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#25D366]/15 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-[#25D366]" />
          </div>
          <h2 className="text-lg font-bold text-foreground text-center">
            Seu WhatsApp foi desconectado
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-center leading-relaxed">
            A conexão do WhatsApp expira automaticamente a cada 72 horas durante os testes. Para
            continuar utilizando seu Assistente Financeiro IA basta tocar no botão abaixo.
          </p>
          <div className="mt-5 space-y-2">
            <ReconnectButton label="Reconectar WhatsApp" onClick={handleReconnect} loading={checking} />
            <button
              onClick={handleAlreadyDone}
              disabled={checking}
              className="w-full rounded-2xl bg-card-elevated py-2.5 text-xs font-semibold text-foreground border border-border disabled:opacity-60"
            >
              {checking ? "Verificando…" : "Já reconectei"}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            Uma mensagem já vem pronta: só tocar em <strong>Enviar</strong>.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Botão permanente para Configurações / Meu Assessor.
 * Executa exatamente o mesmo fluxo do modal (join column-package).
 */
export function SandboxConnectButton() {
  const { status, isLoading } = useSandboxStatus();

  if (!IS_TWILIO_SANDBOX || !SANDBOX_NUMBER_CONFIGURED) return null;

  const connected = status.connected;

  return (
    <div className="rounded-3xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#25D366]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground">Conexão do WhatsApp</h2>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Verificando conexão…"
              : connected
                ? status.hoursRemaining != null
                  ? `Conectado • expira em ~${status.hoursRemaining}h`
                  : "Conectado"
                : "Reconecte para usar seu Assistente por lá."}
          </p>
        </div>
        {!isLoading &&
          (connected ? (
            <ShieldCheck className="h-5 w-5 text-[#25D366] shrink-0" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          ))}
      </div>
      <ReconnectButton
        label={connected ? "Renovar conexão" : "Conectar WhatsApp"}
        onClick={openSandboxReconnect}
      />
    </div>
  );
}
