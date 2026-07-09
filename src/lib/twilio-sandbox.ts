/**
 * Serviço central da reconexão do WhatsApp via Twilio Sandbox.
 *
 * O Twilio Sandbox exige que o usuário reenvie "join <keyword>" a cada 72h.
 * Este módulo encapsula TODA a lógica de detecção/expiração para que as telas
 * apenas consumam `computeSandboxStatus()` e os helpers de link.
 *
 * Produção (número oficial do WhatsApp Business): defina
 * VITE_TWILIO_SANDBOX="false" para desabilitar completamente este fluxo — o
 * app volta a funcionar sem exigir reconexão.
 */

import { ADVISOR_WHATSAPP_DIGITS, advisorWhatsappLink } from "./advisor";

/** Liga/desliga todo o fluxo de reconexão do Sandbox. Ligado por padrão. */
export const IS_TWILIO_SANDBOX =
  (import.meta.env.VITE_TWILIO_SANDBOX ?? "true").toString().trim().toLowerCase() !== "false";

/** Palavra-chave do Sandbox (ex.: "column-package" -> "join column-package"). */
export const SANDBOX_JOIN_KEYWORD = (
  import.meta.env.VITE_TWILIO_SANDBOX_KEYWORD ?? "column-package"
)
  .toString()
  .trim();

/** Mensagem exata que o usuário precisa enviar para reingressar no Sandbox. */
export const SANDBOX_JOIN_MESSAGE = `join ${SANDBOX_JOIN_KEYWORD}`;

/** Duração da sessão do Sandbox e antecedência do lembrete preventivo. */
export const SANDBOX_TTL_HOURS = 72;
export const RENEW_THRESHOLD_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;
const LOCAL_KEY = "finlux.sandbox.connectedAt";

/** Link wa.me que abre o WhatsApp já com "join column-package" preenchido. */
export function sandboxJoinLink(): string {
  return advisorWhatsappLink(SANDBOX_JOIN_MESSAGE);
}

/** Número do Sandbox disponível? (mesma origem do "Meu Assessor"). */
export const SANDBOX_NUMBER_CONFIGURED = ADVISOR_WHATSAPP_DIGITS.length >= 8;

/** Marca localmente o momento em que o usuário tocou em "Reconectar" (otimista). */
export function markLocalReconnect(ts: number = Date.now()): void {
  try {
    localStorage.setItem(LOCAL_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

/** Timestamp otimista salvo localmente (ou null). */
export function getLocalReconnect(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Limpa a marca local (usado ao desconectar). */
export function clearLocalReconnect(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

export type SandboxStatus = {
  /** Conexão ativa dentro da janela de 72h. */
  connected: boolean;
  /** Sessão expirada (já houve conexão, mas passou de 72h). */
  expired: boolean;
  /** Faltam menos de 12h para expirar (lembrete preventivo). */
  expiringSoon: boolean;
  /** Nunca conectou (sem timestamp algum). */
  neverConnected: boolean;
  /** Momento da última atividade considerada (ms epoch) ou null. */
  connectedAt: number | null;
  /** Momento de expiração (ms epoch) ou null. */
  expiresAt: number | null;
  /** Horas restantes até expirar (arredondadas), ou null. */
  hoursRemaining: number | null;
};

/**
 * Calcula o status do Sandbox combinando o sinal do servidor (última mensagem
 * recebida do usuário no webhook) com a marca local otimista da reconexão.
 * Considera a mais recente das duas fontes.
 */
export function computeSandboxStatus(
  serverConnectedAt?: string | number | null,
  now: number = Date.now(),
): SandboxStatus {
  const serverTs =
    serverConnectedAt == null
      ? null
      : typeof serverConnectedAt === "number"
        ? serverConnectedAt
        : Date.parse(serverConnectedAt);
  const localTs = getLocalReconnect();

  const candidates = [serverTs, localTs].filter(
    (t): t is number => typeof t === "number" && Number.isFinite(t),
  );
  const connectedAt = candidates.length ? Math.max(...candidates) : null;

  if (connectedAt == null) {
    return {
      connected: false,
      expired: false,
      expiringSoon: false,
      neverConnected: true,
      connectedAt: null,
      expiresAt: null,
      hoursRemaining: null,
    };
  }

  const expiresAt = connectedAt + SANDBOX_TTL_HOURS * HOUR_MS;
  const msRemaining = expiresAt - now;
  const hoursRemaining = Math.max(0, Math.ceil(msRemaining / HOUR_MS));
  const connected = msRemaining > 0;

  return {
    connected,
    expired: !connected,
    expiringSoon: connected && msRemaining <= RENEW_THRESHOLD_HOURS * HOUR_MS,
    neverConnected: false,
    connectedAt,
    expiresAt,
    hoursRemaining,
  };
}
