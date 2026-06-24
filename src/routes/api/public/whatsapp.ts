import { createFileRoute } from "@tanstack/react-router";
import { extractTransactions, type ExtractInput } from "@/lib/extract.server";
import { normalizePhone, phoneCandidates } from "@/lib/whatsapp.functions";

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message,
  )}</Message></Response>`;
  return new Response(xml, { headers: { "content-type": "text/xml; charset=utf-8" } });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Baixa uma mídia do Twilio através do gateway de conectores da Lovable. */
async function fetchTwilioMedia(
  mediaUrl: string,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) return null;

  // mediaUrl: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MM}/Media/{ME}
  const idx = mediaUrl.indexOf("/Messages/");
  if (idx === -1) return null;
  const path = mediaUrl.slice(idx); // /Messages/.../Media/...
  const res = await fetch(`https://connector-gateway.lovable.dev/twilio${path}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return { buffer: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "" };
}

type AudioFormat = "wav" | "mp3" | "webm" | "m4a" | "ogg" | "aac" | "flac";
function audioFormat(mime: string): AudioFormat {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "ogg";
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return twiml("Serviço temporariamente indisponível. Tente mais tarde.");

        const form = await request.formData();
        const from = String(form.get("From") || "");
        const body = String(form.get("Body") || "").trim();
        const numMedia = parseInt(String(form.get("NumMedia") || "0"), 10) || 0;
        const phone = normalizePhone(from);

        if (!phone) return twiml("Não consegui identificar seu número.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: link } = await supabaseAdmin
          .from("whatsapp_links")
          .select("user_id, verified, verification_code")
          .eq("phone", phone)
          .maybeSingle();

        if (!link) {
          return twiml(
            "Olá! Seu número ainda não está conectado ao Finlux. Abra o app, vá em *Meu Assessor* e conecte seu WhatsApp para começar a registrar gastos por aqui. 💜",
          );
        }

        // Etapa de confirmação do número.
        if (!link.verified) {
          if (body && link.verification_code && body.replace(/\D/g, "") === link.verification_code) {
            await supabaseAdmin
              .from("whatsapp_links")
              .update({ verified: true, verification_code: null })
              .eq("phone", phone);
            return twiml(
              "✅ Número confirmado! Agora é só mandar uma mensagem, foto da nota ou áudio que eu registro seu gasto automaticamente.",
            );
          }
          return twiml(
            `Para confirmar seu número, envie aqui o código de 6 dígitos que aparece no app em *Meu Assessor*.`,
          );
        }

        // Número verificado: extrai a transação.
        const input: ExtractInput = {};
        if (body) input.text = body;

        if (numMedia > 0) {
          const mediaUrl = String(form.get("MediaUrl0") || "");
          const mediaType = String(form.get("MediaContentType0") || "");
          const media = await fetchTwilioMedia(mediaUrl);
          if (!media) {
            return twiml(
              "Recebi sua mídia, mas ainda não consegui baixá-la. Verifique a conexão do WhatsApp/Twilio ou descreva o gasto por texto. 🙏",
            );
          }
          const b64 = Buffer.from(media.buffer).toString("base64");
          if (media.contentType.startsWith("image/") || mediaType.startsWith("image/")) {
            input.imageDataUrl = `data:${media.contentType || mediaType};base64,${b64}`;
          } else if (media.contentType.startsWith("audio/") || mediaType.startsWith("audio/")) {
            input.audio = { base64: b64, format: audioFormat(media.contentType || mediaType) };
          }
        }

        if (!input.text && !input.imageDataUrl && !input.audio) {
          return twiml(
            "Manda o que você gastou (texto, foto da nota ou áudio) que eu registro pra você. 😉",
          );
        }

        let txs;
        try {
          txs = await extractTransactions(input, apiKey);
        } catch {
          return twiml("Tive um problema ao analisar. Pode tentar de novo em instantes?");
        }

        if (!txs.length) {
          return twiml(
            "Não consegui entender a transação. Tente algo como: \"Gastei 35 reais no almoço\".",
          );
        }

        const rows = txs.map((t) => ({
          user_id: link.user_id,
          kind: t.kind,
          amount: t.amount,
          category: t.category,
          description: t.description || t.category,
          date: new Date(t.date).toISOString(),
        }));

        const { error } = await supabaseAdmin.from("transactions").insert(rows);
        if (error) {
          return twiml("Consegui ler, mas não deu pra salvar agora. Tente novamente, por favor.");
        }

        const lines = txs.map(
          (t) =>
            `${t.kind === "receita" ? "🟢" : "🔴"} ${brl(t.amount)} — ${t.description || t.category} (${t.category})`,
        );
        return twiml(
          `✅ Registrado!\n\n${lines.join("\n")}\n\nVeja tudo no app Finlux. 💜`,
        );
      },
    },
  },
});
