import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mantém apenas dígitos. Ex.: "whatsapp:+55 (11) 99999-9999" -> "5511999999999" */
export function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export type WhatsappLink = {
  phone: string;
  verified: boolean;
  verification_code: string | null;
};

/** Retorna o vínculo de WhatsApp do usuário atual (ou null). */
export const getWhatsappLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappLink | null> => {
    const { data, error } = await context.supabase
      .from("whatsapp_links")
      .select("phone, verified, verification_code")
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
