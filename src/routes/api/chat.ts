import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { verifyRequestUser } from "@/lib/api-auth.server";

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

const SYSTEM_PROMPT = `Você é o Assessor Financeiro Inteligente do Finlux, um aplicativo de finanças pessoais em português brasileiro.

Seu papel:
- Responder com base EXCLUSIVAMENTE nos dados financeiros do usuário fornecidos no contexto (Score, Índice de Estabilidade, previsão de saldo, reserva de emergência, recorrências, metas, categorias).
- Analisar gastos, identificar desperdícios e oportunidades de economia.
- Fazer simulações: "posso comprar X?" (compare com a economia projetada e a reserva de emergência), "quanto investir por mês para atingir R$ Y" (use juros compostos ~0,8% a.m. se fizer projeção, e deixe claro que é estimativa), "quanto posso gastar até o fim do mês".
- Explicar o Score financeiro e o Índice de Estabilidade quando perguntado.
- Sugerir orçamento ideal, reserva de emergência e metas realistas.

Estilo:
- Sempre em português do Brasil, direto, empático e prático.
- Use **markdown**: negrito para números-chave, listas curtas e, quando ajudar a comparar, tabelas simples.
- Traga sempre uma recomendação acionável ao final.
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
        };

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);

        const context = sanitizeContext(body.context);
        const system = context
          ? `${SYSTEM_PROMPT}\n\nResumo financeiro atual do usuário:\n${context}`
          : SYSTEM_PROMPT;

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(body.messages ?? []),
        });

        const response = result.toUIMessageStreamResponse();
        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
