/**
 * Configuração central do contato do "Meu Assessor" (WhatsApp).
 * O número NUNCA deve ser fixado no código das telas — sempre use este módulo,
 * alimentado pela variável de ambiente VITE_ADVISOR_WHATSAPP.
 */

const RAW = (import.meta.env.VITE_ADVISOR_WHATSAPP ?? "").toString().trim();

/** Apenas os dígitos do número (ex.: "14155238886"). Vazio se não configurado. */
export const ADVISOR_WHATSAPP_DIGITS = RAW.replace(/\D/g, "");

/** Indica se o contato do assessor está configurado e disponível. */
export const ADVISOR_CONFIGURED = ADVISOR_WHATSAPP_DIGITS.length >= 8;

/** Número formatado para exibição (ex.: "+1 415 523 8886"). */
export function advisorDisplayNumber(): string {
  const d = ADVISOR_WHATSAPP_DIGITS;
  if (!d) return "";
  // Formatação genérica e legível: +DDI resto agrupado.
  if (d.startsWith("1") && d.length === 11) {
    // EUA/Canadá: +1 415 523 8886
    return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (d.length >= 12) {
    const ddi = d.slice(0, d.length - 11);
    const ddd = d.slice(-11, -9);
    return `+${ddi} ${ddd} ${d.slice(-9, -4)}-${d.slice(-4)}`;
  }
  return `+${d}`;
}

/** Link wa.me que abre o app do WhatsApp (ou WhatsApp Web no desktop). */
export function advisorWhatsappLink(message?: string): string {
  if (!ADVISOR_CONFIGURED) return "";
  const base = `https://wa.me/${ADVISOR_WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
