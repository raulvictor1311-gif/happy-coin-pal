import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { extractTransactions, type ExtractInput } from "@/lib/extract.server";
import { normalizePhone, phoneCandidates } from "@/lib/whatsapp.functions";

/**
 * Reconstructs the candidate public URLs Twilio may have used to sign the
 * request. Behind proxies (Cloudflare/Lovable) the proto/host can differ from
 * what Twilio has configured, so we validate the signature against a few
 * plausible variants (http/https, forwarded vs. direct host, trailing slash).
 */
function getWebhookUrlCandidates(request: Request): string[] {
  const override = process.env.TWILIO_WEBHOOK_URL;
  if (override) return [override, override.replace(/\/$/, ""), override.replace(/\/?$/, "/")];

  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search; // preserve any query string Twilio signs over
  const protos = new Set<string>();
  const fwdProto = request.headers.get("x-forwarded-proto");
  if (fwdProto) protos.add(fwdProto.split(",")[0].trim());
  protos.add(url.protocol.replace(":", ""));
  protos.add("https"); // Twilio always calls the public HTTPS endpoint

  const hosts = new Set<string>();
  const fwdHost = request.headers.get("x-forwarded-host");
  if (fwdHost) hosts.add(fwdHost.split(",")[0].trim());
  const host = request.headers.get("host");
  if (host) hosts.add(host);
  hosts.add(url.host);

  const candidates = new Set<string>();
  for (const proto of protos) {
    for (const h of hosts) {
      if (!h) continue;
      candidates.add(`${proto}://${h}${pathname}${search}`);
      candidates.add(`${proto}://${h}${pathname}`);
    }
  }
  return [...candidates];
}

/**
 * Computes Twilio's expected X-Twilio-Signature (HMAC-SHA1 over the URL +
 * the alphabetically sorted POST params).
 */
function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], "");
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/** Constant-time comparison of two base64 signatures. */
function signaturesMatch(expected: string, signature: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Validates the request signature against every plausible webhook URL. */
function isValidTwilioRequest(
  authToken: string,
  signature: string,
  request: Request,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  for (const url of getWebhookUrlCandidates(request)) {
    if (signaturesMatch(computeTwilioSignature(authToken, url, params), signature)) return true;
  }
  return false;
}

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

const HELP_TEXT =
  "🤖 *Finlux — Meu Assessor*\n\nSou seu consultor financeiro. Fale comigo naturalmente!\n\n📌 *Registrar gastos/receitas:*\n• ✍️ \"Gastei 35 no almoço\"\n• 📷 Foto da nota/recibo\n• 🎤 Áudio contando o gasto\n\n💬 *Me pergunte qualquer coisa:*\n• \"Posso comprar um celular de 2 mil?\"\n• \"Onde estou gastando demais?\"\n• \"Quanto guardar por mês?\"\n\n⚡ *Comandos rápidos:*\n• *saldo* — saldo do mês\n• *resumo* — receitas, despesas e categorias\n• *score* — seu Score financeiro\n• *estabilidade* — Índice de Estabilidade\n• *previsão* — previsão de saldo do mês\n• *dicas* — onde economizar\n• *ajuda* — esta mensagem";

type Command = "saldo" | "resumo" | "ajuda" | "score" | "estabilidade" | "previsao" | "dicas";

/** Detecta comandos de consulta (não são transações). */
function detectCommand(body: string): Command | null {
  const t = body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (["ajuda", "help", "menu", "comandos", "?"].includes(t)) return "ajuda";
  if (["saldo", "quanto tenho", "meu saldo"].includes(t)) return "saldo";
  if (["resumo", "resumo do mes", "relatorio", "extrato"].includes(t)) return "resumo";
  if (["score", "meu score", "score financeiro", "pontuacao"].includes(t)) return "score";
  if (["estabilidade", "indice", "indice de estabilidade", "estavel"].includes(t))
    return "estabilidade";
  if (["previsao", "previsao do mes", "futuro", "vou fechar no azul", "projecao"].includes(t))
    return "previsao";
  if (["dicas", "economia", "economizar", "desperdicio", "desperdicios", "onde economizar"].includes(t))
    return "dicas";
  return null;
}

/** Gera o resumo financeiro do mês atual do usuário a partir das transações. */
async function monthlySummary(
  supabaseAdmin: any,
  userId: string,
): Promise<{ income: number; expense: number; balance: number; topCategories: [string, number][] }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { data } = await supabaseAdmin
    .from("transactions")
    .select("kind, amount, category, date")
    .eq("user_id", userId)
    .gte("date", start)
    .lt("date", end);

  const rows: { kind: string; amount: number; category: string }[] = data ?? [];
  let income = 0;
  let expense = 0;
  const byCat = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    if (r.kind === "receita") {
      income += amt;
    } else {
      expense += amt;
      byCat.set(r.category, (byCat.get(r.category) || 0) + amt);
    }
  }
  const topCategories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { income, expense, balance: income - expense, topCategories };
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

        // Verify the request genuinely came from Twilio before trusting any
        // field (especially "From"), preventing forged transaction injection.
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const signature = request.headers.get("x-twilio-signature") ?? "";
        const params: Record<string, string> = {};
        for (const [k, v] of form.entries()) {
          if (typeof v === "string") params[k] = v;
        }
        if (!authToken) {
          // Without the Auth Token we cannot validate Twilio's signature, so
          // every request would silently 403. Log clearly so it's obvious the
          // TWILIO_AUTH_TOKEN secret is missing from the deployment.
          console.error(
            "[whatsapp] TWILIO_AUTH_TOKEN não configurado — não é possível validar a assinatura da Twilio.",
          );
          return new Response("Webhook not configured", { status: 500 });
        }
        if (!isValidTwilioRequest(authToken, signature, request, params)) {
          console.warn(
            `[whatsapp] Assinatura inválida. hasSignature=${Boolean(signature)} url=${request.url}`,
          );
          return new Response("Forbidden", { status: 403 });
        }

        const from = String(form.get("From") || "");
        const body = String(form.get("Body") || "").trim();
        const numMedia = parseInt(String(form.get("NumMedia") || "0"), 10) || 0;
        const phone = normalizePhone(from);

        if (!phone) return twiml("Não consegui identificar seu número.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: link } = await supabaseAdmin
          .from("whatsapp_links")
          .select("user_id, verified, verification_code, phone")
          .in("phone", phoneCandidates(phone))
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
              .eq("phone", link.phone);
            return twiml(
              "✅ Número confirmado! Agora é só mandar uma mensagem, foto da nota ou áudio que eu registro seu gasto automaticamente.",
            );
          }
          return twiml(
            `Para confirmar seu número, envie aqui o código de 6 dígitos que aparece no app em *Meu Assessor*.`,
          );
        }

        // Comandos de consulta (não são transações).
        if (numMedia === 0 && body) {
          const cmd = detectCommand(body);
          if (cmd === "ajuda") return twiml(HELP_TEXT);
          if (cmd === "saldo") {
            const s = await monthlySummary(supabaseAdmin, link.user_id);
            const emoji = s.balance >= 0 ? "🟢" : "🔴";
            return twiml(
              `${emoji} *Saldo do mês:* ${brl(s.balance)}\n\nReceitas: ${brl(s.income)}\nDespesas: ${brl(s.expense)}`,
            );
          }
          if (cmd === "resumo") {
            const s = await monthlySummary(supabaseAdmin, link.user_id);
            const cats = s.topCategories.length
              ? s.topCategories.map((c) => `• ${c[0]}: ${brl(c[1])}`).join("\n")
              : "Sem despesas registradas ainda.";
            return twiml(
              `📊 *Resumo do mês*\n\n🟢 Receitas: ${brl(s.income)}\n🔴 Despesas: ${brl(s.expense)}\n${
                s.balance >= 0 ? "🟢" : "🔴"
              } Saldo: ${brl(s.balance)}\n\n*Onde você mais gastou:*\n${cats}`,
            );
          }
          if (cmd === "score" || cmd === "estabilidade" || cmd === "previsao" || cmd === "dicas") {
            const advisor = await import("@/lib/whatsapp-advisor.server");
            const state = await advisor.loadFinanceState(supabaseAdmin, link.user_id);
            if (cmd === "score") return twiml(advisor.scoreMessage(state));
            if (cmd === "estabilidade") return twiml(advisor.stabilityMessage(state));
            if (cmd === "previsao") return twiml(advisor.forecastMessage(state));
            return twiml(advisor.wasteMessage(state));
          }
        }


        // Número verificado: coleta texto + todas as mídias (foto/áudio) enviadas.
        const inputs: ExtractInput[] = [];
        if (body) inputs.push({ text: body });

        let mediaFailed = false;
        for (let i = 0; i < numMedia; i++) {
          const mediaUrl = String(form.get(`MediaUrl${i}`) || "");
          const mediaType = String(form.get(`MediaContentType${i}`) || "");
          if (!mediaUrl) continue;
          const media = await fetchTwilioMedia(mediaUrl);
          if (!media) {
            mediaFailed = true;
            continue;
          }
          const b64 = Buffer.from(media.buffer).toString("base64");
          const ct = media.contentType || mediaType;
          if (ct.startsWith("image/")) {
            inputs.push({ imageDataUrl: `data:${ct};base64,${b64}` });
          } else if (ct.startsWith("audio/")) {
            inputs.push({ audio: { base64: b64, format: audioFormat(ct) } });
          }
        }

        if (inputs.length === 0) {
          if (mediaFailed) {
            return twiml(
              "Recebi sua mídia, mas ainda não consegui baixá-la. Verifique a conexão do WhatsApp/Twilio ou descreva o gasto por texto. 🙏",
            );
          }
          return twiml(
            "Manda o que você gastou (texto, foto da nota ou áudio) que eu registro pra você. Digite *ajuda* para ver os comandos. 😉",
          );
        }

        let txs: Awaited<ReturnType<typeof extractTransactions>> = [];
        try {
          const results = await Promise.all(inputs.map((inp) => extractTransactions(inp, apiKey)));
          txs = results.flat();
        } catch {
          return twiml("Tive um problema ao analisar. Pode tentar de novo em instantes?");
        }

        if (!txs.length) {
          // Sem transação em uma mensagem só de texto → conversa natural: o
          // Assessor responde como consultor usando os dados reais do usuário.
          if (numMedia === 0 && body) {
            try {
              const advisor = await import("@/lib/whatsapp-advisor.server");
              const state = await advisor.loadFinanceState(supabaseAdmin, link.user_id);
              const answer = await advisor.answerAdvisorQuestion(body, state, apiKey);
              return twiml(advisor.toWhatsappText(answer));
            } catch {
              return twiml(
                "Não consegui analisar agora. Tente de novo em instantes, ou registre um gasto assim: \"Gastei 35 no almoço\". 🙏",
              );
            }
          }
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
