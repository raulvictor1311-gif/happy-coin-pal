// Extração de transações financeiras via Lovable AI Gateway.
// Usado tanto pela rota /api/extract-tx (app) quanto pelo webhook do WhatsApp.

export type ExtractedTx = {
  kind: "receita" | "despesa";
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
};

export type ExtractInput = {
  text?: string;
  imageDataUrl?: string;
  audio?: {
    base64: string;
    format: "wav" | "mp3" | "webm" | "m4a" | "ogg" | "aac" | "flac";
  };
};

const EXPENSE = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Internet e telefone",
  "Vestuário",
  "Impostos",
  "Outros",
];
const INCOME = ["Salário", "Freelance", "Comissão", "Rendimentos", "Outras receitas"];

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

export async function extractTransactions(
  input: ExtractInput,
  apiKey: string,
): Promise<ExtractedTx[]> {
  const today = new Date().toISOString().slice(0, 10);

  const content: any[] = [
    { type: "text", text: `Hoje é ${today}. Extraia a(s) transação(ões) da entrada abaixo.` },
  ];
  if (input.text?.trim()) content.push({ type: "text", text: input.text.trim() });
  if (input.imageDataUrl)
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  if (input.audio?.base64)
    content.push({
      type: "input_audio",
      input_audio: { data: input.audio.base64, format: input.audio.format },
    });

  if (content.length === 1) return [];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
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
    throw new Error(`gateway ${res.status}: ${await res.text()}`);
  }

  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    parsed = {};
  }
  const txs = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
  return txs.map((t: any) => ({
    kind: t.kind === "receita" ? "receita" : "despesa",
    amount: Math.max(0, Number(t.amount) || 0),
    category: String(t.category || "Outros"),
    description: String(t.description || ""),
    date: String(t.date || today),
  }));
}
