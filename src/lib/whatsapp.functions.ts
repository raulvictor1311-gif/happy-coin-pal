import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mantém apenas dígitos. Ex.: "whatsapp:+55 (11) 99999-9999" -> "5511999999999" */
export function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/**
 * Gera as variações plausíveis de um número para casar registros salvos de
 * formas diferentes (com/sem DDI 55 e com/sem o 9º dígito de celular).
 */
export function phoneCandidates(raw: string): string[] {
  const phone = normalizePhone(raw);
  const set = new Set<string>();
  if (!phone) return [];
  set.add(phone);
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  set.add(local);
  set.add("55" + local);
  if (local.length === 11) {
    const without9 = local.slice(0, 2) + local.slice(3);
    set.add(without9);
    set.add("55" + without9);
  } else if (local.length === 10) {
    const with9 = local.slice(0, 2) + "9" + local.slice(2);
    set.add(with9);
    set.add("55" + with9);
  }
  return [...set];
}

/** Hash SHA-256 do código concatenado com o salt (hex). */
export function hashVerificationCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

/** Tempo de validade dos códigos de verificação. */
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export type WhatsappLink = {
  phone: string;
  verified: boolean;
  /** True quando existe um código pendente (não expirado). O valor em si nunca é exposto. */
  code_pending: boolean;
  code_expires_at: string | null;
  sandbox_connected_at: string | null;
};

/** Retorna o vínculo de WhatsApp do usuário atual (ou null). Nunca expõe o código. */
export const getWhatsappLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappLink | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_links")
      .select(
        "phone, verified, verification_code_hash, verification_code_expires_at, sandbox_connected_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const expiresAt = (data as any).verification_code_expires_at as string | null;
    const notExpired = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
    return {
      phone: data.phone,
      verified: data.verified,
      code_pending: Boolean((data as any).verification_code_hash) && notExpired,
      code_expires_at: notExpired ? expiresAt : null,
      sandbox_connected_at: data.sandbox_connected_at ?? null,
    };
  });

/** Retorno da geração de código — o código em texto puro é devolvido APENAS uma vez. */
export type RegisterResult = WhatsappLink & { verification_code: string };

/** Registra/atualiza o número do usuário e gera um novo código de confirmação. */
export const registerWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string }) => data)
  .handler(async ({ data, context }): Promise<RegisterResult> => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 10 || phone.length > 15) {
      throw new Error("Número inválido. Use o formato com DDI e DDD, ex.: +55 11 99999-9999.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const salt = randomBytes(16).toString("hex");
    const hash = hashVerificationCode(code, salt);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_links")
      .select("user_id, verified")
      .eq("phone", phone)
      .maybeSingle();
    if (existing && existing.user_id !== context.userId && existing.verified) {
      throw new Error("Este número de WhatsApp já está vinculado a outra conta.");
    }

    await supabaseAdmin.from("whatsapp_links").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("whatsapp_links").delete().eq("phone", phone);

    const { data: inserted, error } = await supabaseAdmin
      .from("whatsapp_links")
      .insert({
        user_id: context.userId,
        phone,
        verified: false,
        verification_code: null,
        verification_code_hash: hash,
        verification_code_salt: salt,
        verification_code_expires_at: expiresAt,
      } as any)
      .select("phone, verified, sandbox_connected_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      phone: inserted.phone,
      verified: inserted.verified,
      code_pending: true,
      code_expires_at: expiresAt,
      sandbox_connected_at: inserted.sandbox_connected_at ?? null,
      verification_code: code,
    };
  });

/** Remove o vínculo de WhatsApp do usuário. */
export const removeWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("whatsapp_links")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
