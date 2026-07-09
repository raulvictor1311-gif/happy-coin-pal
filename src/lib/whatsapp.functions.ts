import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mantém apenas dígitos. Ex.: "whatsapp:+55 (11) 99999-9999" -> "5511999999999" */
export function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/**
 * Gera as variações plausíveis de um número para casar registros salvos de
 * formas diferentes (com/sem DDI 55 e com/sem o 9º dígito de celular).
 * Ex.: "5519984216068" -> ["5519984216068", "19984216068", "1984216068", ...]
 */
export function phoneCandidates(raw: string): string[] {
  const phone = normalizePhone(raw);
  const set = new Set<string>();
  if (!phone) return [];
  set.add(phone);

  // Forma com e sem o DDI 55 (Brasil).
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  set.add(local);
  set.add("55" + local);

  // Variação do 9º dígito do celular (DDD de 2 dígitos + número).
  if (local.length === 11) {
    // remove o 9 logo após o DDD
    const without9 = local.slice(0, 2) + local.slice(3);
    set.add(without9);
    set.add("55" + without9);
  } else if (local.length === 10) {
    // adiciona o 9 logo após o DDD
    const with9 = local.slice(0, 2) + "9" + local.slice(2);
    set.add(with9);
    set.add("55" + with9);
  }

  return [...set];
}

export type WhatsappLink = {
  phone: string;
  verified: boolean;
  verification_code: string | null;
  /** Última vez que o usuário esteve ativo no Sandbox (webhook). */
  sandbox_connected_at: string | null;
};

/** Retorna o vínculo de WhatsApp do usuário atual (ou null).
 *  A coluna verification_code não é exposta via Data API ao cliente; por isso
 *  lemos esse vínculo pelo service role, sempre restrito ao próprio usuário. */
export const getWhatsappLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappLink | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_links")
      .select("phone, verified, verification_code, sandbox_connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

/** Registra/atualiza o número do usuário e gera um novo código de confirmação. */
export const registerWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string }) => data)
  .handler(async ({ data, context }): Promise<WhatsappLink> => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 10 || phone.length > 15) {
      throw new Error("Número inválido. Use o formato com DDI e DDD, ex.: +55 11 99999-9999.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Garante que o número não pertence a outro usuário já confirmado.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_links")
      .select("user_id, verified")
      .eq("phone", phone)
      .maybeSingle();
    if (existing && existing.user_id !== context.userId && existing.verified) {
      throw new Error("Este número de WhatsApp já está vinculado a outra conta.");
    }

    // Remove qualquer vínculo anterior deste usuário e do número, depois insere.
    await supabaseAdmin.from("whatsapp_links").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("whatsapp_links").delete().eq("phone", phone);

    const { data: inserted, error } = await supabaseAdmin
      .from("whatsapp_links")
      .insert({ user_id: context.userId, phone, verified: false, verification_code: code })
      .select("phone, verified, verification_code")
      .single();
    if (error) throw new Error(error.message);
    return inserted as WhatsappLink;
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
