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

const SYSTEM_PROMPT = `Você é o assistente financeiro inteligente do Finlux, um aplicativo de finanças pessoais em português brasileiro.

Seu papel:
- Analisar gastos e identificar desperdícios
- Gerar insights automáticos e personalizados
- Sugerir formas de economizar
- Calcular quanto investir por mês
- Prever o saldo até o fim do mês
- Tirar dúvidas sobre educação financeira (juros, investimentos, dívidas)

Estilo:
- Responda sempre em português do Brasil
- Seja direto, empático e prático
- Use listas e números curtos quando ajudar
- Quando o usuário enviar um resumo financeiro no contexto (rendas, despesas, categorias), use-o para personalizar a resposta
- Nunca invente valores. Se faltar dado, peça com simpatia.`;

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
