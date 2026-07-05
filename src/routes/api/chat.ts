import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { verifyRequestUser } from "@/lib/api-auth.server";
import { formatBRL } from "@/lib/format";

/** Limits the user-provided financial context injected into the system prompt
 *  to reduce prompt-injection risk and runaway token usage. */
function sanitizeContext(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .slice(0, 4000)
    .replace(/```/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

/** Numeric snapshot passed from the client (mirrors FinanceFacts). */
type FinanceFacts = {
  income: number;
  spentSoFar: number;
  projectedSavings: number;
  projectedBalance: number;
  daysRemaining: number;
  safeDailySpend: number;
  reserveCurrent: number;
  reserveTarget: number;
  monthlyExpense: number;
  score: number;
  stability: number;
  goals: { title: string; target: number; saved: number; deadline?: string }[];
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeFacts(raw: unknown): FinanceFacts | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const goalsRaw = Array.isArray(r.goals) ? r.goals : [];
  return {
    income: num(r.income),
    spentSoFar: num(r.spentSoFar),
    projectedSavings: num(r.projectedSavings),
    projectedBalance: num(r.projectedBalance),
    daysRemaining: num(r.daysRemaining),
    safeDailySpend: num(r.safeDailySpend),
    reserveCurrent: num(r.reserveCurrent),
    reserveTarget: num(r.reserveTarget),
    monthlyExpense: num(r.monthlyExpense),
    score: num(r.score),
    stability: num(r.stability),
    goals: goalsRaw.slice(0, 10).map((g) => {
      const gr = (g ?? {}) as Record<string, unknown>;
      return {
        title: String(gr.title ?? "Meta"),
        target: num(gr.target),
        saved: num(gr.saved),
        deadline: gr.deadline ? String(gr.deadline) : undefined,
      };
    }),
  };
}

/** Aporte mensal para uma meta (juros compostos opcionais). */
function monthlyInvestmentForGoal(target: number, months: number, currentSaved = 0, monthlyRate = 0): number {
  const remaining = Math.max(0, target - currentSaved);
  if (months <= 0) return remaining;
  if (monthlyRate <= 0) return remaining / months;
  const factor = Math.pow(1 + monthlyRate, months) - 1;
  return factor > 0 ? (remaining * monthlyRate) / factor : remaining / months;
}

const SYSTEM_PROMPT = `Você é o Assessor Financeiro Inteligente do Finlux, um aplicativo de finanças pessoais em português brasileiro.

Seu papel:
- Responder com base EXCLUSIVAMENTE nos dados financeiros do usuário fornecidos no contexto (Score, Índice de Estabilidade, previsão de saldo, reserva de emergência, recorrências, metas, categorias).
- Analisar gastos, identificar desperdícios e oportunidades de economia.
- Usar as FERRAMENTAS disponíveis para cálculos precisos antes de responder:
  - "simular_compra" para "posso comprar X de R$ Y?";
  - "investir_para_meta" para "quanto investir por mês para atingir R$ Y";
  - "quanto_posso_gastar" para "quanto posso gastar até o fim do mês".
- Explicar o Score financeiro e o Índice de Estabilidade quando perguntado.
- Sugerir orçamento ideal, reserva de emergência e metas realistas.

Estilo:
- Sempre em português do Brasil, direto, empático e prático.
- Use **markdown**: negrito para números-chave, listas curtas e, quando ajudar a comparar, tabelas simples.
- Após usar uma ferramenta, explique o resultado em linguagem natural e traga uma recomendação acionável.
- Nunca invente valores nem prometa rentabilidade garantida. Se faltar um dado, peça com simpatia.
- Se o usuário ainda não tem transações suficientes, incentive-o a registrar pelo Assessor.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyRequestUser(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const body = (await request.json()) as {
          messages: UIMessage[];
          context?: string;
          facts?: unknown;
        };

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);

        const context = sanitizeContext(body.context);
        const facts = sanitizeFacts(body.facts);
        const system = context
          ? `${SYSTEM_PROMPT}\n\nResumo financeiro atual do usuário:\n${context}`
          : SYSTEM_PROMPT;

        // Taxa conservadora só para projeções (0,8% a.m.), sempre rotulada como estimativa.
        const MONTHLY_RATE = 0.008;

        const tools = {
          simular_compra: tool({
            description:
              "Avalia se o usuário pode fazer uma compra de determinado valor, comparando com a economia projetada e a reserva de emergência.",
            inputSchema: z.object({
              preco: z.number().describe("Valor da compra em reais (BRL)."),
            }),
            execute: async ({ preco }) => {
              if (!facts) return { erro: "Sem dados financeiros suficientes." };
              const reserveAfter = facts.reserveCurrent - preco;
              let veredito: "sim" | "com_cautela" | "nao";
              let motivo: string;
              if (preco <= facts.projectedSavings && facts.projectedSavings > 0) {
                veredito = "sim";
                motivo = `Cabe na economia projetada do mês (${formatBRL(facts.projectedSavings)}) sem tocar na reserva.`;
              } else if (reserveAfter >= facts.monthlyExpense * 3) {
                veredito = "com_cautela";
                motivo = `Ultrapassa a economia do mês, mas restariam ${formatBRL(reserveAfter)} de reserva (acima de 3 meses de gastos).`;
              } else {
                veredito = "nao";
                motivo = `Comprometeria a reserva de emergência: restariam apenas ${formatBRL(Math.max(0, reserveAfter))}.`;
              }
              return {
                preco,
                veredito,
                motivo,
                economiaProjetadaMes: facts.projectedSavings,
                reservaAtual: facts.reserveCurrent,
                reservaApos: reserveAfter,
              };
            },
          }),
          investir_para_meta: tool({
            description:
              "Calcula o aporte mensal necessário para atingir um valor-alvo em um número de meses. Retorna com e sem rendimento estimado.",
            inputSchema: z.object({
              alvo: z.number().describe("Valor-alvo em reais (BRL)."),
              meses: z.number().describe("Prazo em meses para atingir o alvo."),
              jaGuardado: z.number().nullable().describe("Quanto já foi guardado, se houver."),
            }),
            execute: async ({ alvo, meses, jaGuardado }) => {
              const saved = jaGuardado ?? 0;
              const m = Math.max(1, Math.round(meses));
              const semJuros = monthlyInvestmentForGoal(alvo, m, saved, 0);
              const comJuros = monthlyInvestmentForGoal(alvo, m, saved, MONTHLY_RATE);
              return {
                alvo,
                meses: m,
                jaGuardado: saved,
                aporteMensalSemRendimento: Math.round(semJuros),
                aporteMensalComRendimentoEstimado: Math.round(comJuros),
                observacao:
                  "O cálculo com rendimento usa ~0,8% a.m. apenas como estimativa; não é rentabilidade garantida.",
              };
            },
          }),
          quanto_posso_gastar: tool({
            description:
              "Informa quanto o usuário ainda pode gastar por dia e no total até o fim do mês, mantendo o saldo saudável.",
            inputSchema: z.object({}),
            execute: async () => {
              if (!facts) return { erro: "Sem dados financeiros suficientes." };
              const totalRestante = facts.safeDailySpend * Math.max(0, facts.daysRemaining);
              return {
                gastoDiarioSeguro: Math.round(facts.safeDailySpend),
                diasRestantes: facts.daysRemaining,
                totalSeguroAteFimDoMes: Math.round(totalRestante),
                saldoProjetadoFimDoMes: Math.round(facts.projectedBalance),
              };
            },
          }),
        };

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          tools,
          stopWhen: stepCountIs(6),
          messages: await convertToModelMessages(body.messages ?? []),
        });

        const response = result.toUIMessageStreamResponse();
        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
