import { createFileRoute } from "@tanstack/react-router";

type ExtractInput = {
  text?: string;
  imageDataUrl?: string;
  audio?: { base64: string; format: "wav" | "mp3" | "webm" | "m4a" | "ogg" | "aac" | "flac" };
};

const EXPENSE = ["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Assinaturas","Internet e telefone","Vestuário","Impostos","Outros"];
const INCOME = ["Salário","Freelance","Comissão","Rendimentos","Outras receitas"];

const SYSTEM = `Você extrai transações financeiras de texto, fotos de notas fiscais/recibos ou áudios em português brasileiro.
Responda APENAS com um JSON válido no formato:
{"transactions":[{"kind":"despesa"|"receita","amount":number,"category":string,"description":string,"date":"YYYY-MM-DD"}]}

Regras:
- Use somente categorias da lista de despesas: ${EXPENSE.join(", ")}.
- Para receitas use: ${INCOME.join(", ")}.
- Se a data não estiver clara, use hoje.
- "amount" sempre positivo, em reais (BRL).
- "description" curta e específica (ex: "Red Bull na farmácia", "Gasolina posto Shell").
- Se a foto for um recibo com vários itens, pode retornar 1 transação total OU várias (uma por item) — prefira 1 total exceto quando categorias forem claramente distintas.
- Se nada puder ser extraído, retorne {"transactions":[]}.
- NÃO escreva texto fora do JSON.`;

export const Route = createFileRoute("/api/extract-tx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500 });
        const body = (await request.json()) as ExtractInput;
        const today = new Date().toISOString().slice(0, 10);

        const content: any[] = [
          { type: "text", text: `Hoje é ${today}. Extraia a(s) transação(ões) da entrada abaixo.` },
        ];
        if (body.text?.trim()) content.push({ type: "text", text: body.text.trim() });
        if (body.imageDataUrl) content.push({ type: "image_url", image_url: { url: body.imageDataUrl } });
        if (body.audio?.base64) content.push({ type: "input_audio", input_audio: { data: body.audio.base64, format: body.audio.format } });

        if (content.length === 1) {
          return new Response(JSON.stringify({ error: "empty" }), { status: 400 });
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content },
            ],
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          return new Response(JSON.stringify({ error: "gateway", detail: t }), { status: 502 });
        }
        const j = await res.json();
        const raw = j?.choices?.[0]?.message?.content ?? "{}";
        let parsed: any = {};
        try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = {}; }
        const txs = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
        return Response.json({ transactions: txs });
      },
    },
  },
});
