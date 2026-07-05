import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { verifyRequestUser } from "@/lib/api-auth.server";

/** Trims the user-provided financial context to bound tokens and reduce
 *  prompt-injection risk before injecting it into the prompt. */
function sanitizeContext(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, 4000).replace(/```/g, "").replace(/\u0000/g, "").trim();
}

const InsightsSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        tone: z.enum(["positive", "warning", "neutral"]),
      }),
    )
    .max(4),
});

const SYSTEM_PROMPT = `Você é o analista financeiro do Finlux, um app de finanças pessoais em português do Brasil.
Com base no resumo financeiro do usuário, gere de 2 a 4 insights curtos, práticos e personalizados.
Regras:
- Escreva em português do Brasil.
- Cada insight tem um "title" curto (máx 6 palavras) e um "detail" objetivo (máx 22 palavras).
- Nunca invente valores; use apenas os dados do resumo.
- Classifique "tone": "positive" (elogio/bom hábito), "warning" (risco/atenção) ou "neutral" (dica/observação).
- Evite repetir literalmente os números; traga interpretação e ação recomendada.`;

export const Route = createFileRoute("/api/insights")({
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

        const body = (await request.json()) as { context?: string };
        const context = sanitizeContext(body.context);
        if (!context) {
          return new Response(JSON.stringify({ insights: [] }), {
            headers: { "content-type": "application/json" },
          });
        }

        const gateway = createLovableAiGatewayProvider(key);

        try {
          const { output } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system: SYSTEM_PROMPT,
            prompt: `Resumo financeiro atual:\n${context}`,
            output: Output.object({ schema: InsightsSchema }),
          });
          return new Response(JSON.stringify(output ?? { insights: [] }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const status =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          if (status === 429) {
            return new Response(JSON.stringify({ error: "rate_limited" }), {
              status: 429,
              headers: { "content-type": "application/json" },
            });
          }
          if (status === 402) {
            return new Response(JSON.stringify({ error: "no_credits" }), {
              status: 402,
              headers: { "content-type": "application/json" },
            });
          }
          // The gateway call succeeded but the model output didn't conform to the
          // schema. Try to recover the raw JSON; otherwise degrade gracefully.
          if (NoObjectGeneratedError.isInstance(err)) {
            const parsed = safeParseInsights(err.text);
            return new Response(JSON.stringify(parsed ?? { insights: [] }), {
              headers: { "content-type": "application/json" },
            });
          }
          console.error("insights generation failed", err);
          return new Response(JSON.stringify({ insights: [] }), {
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

/** Best-effort parse of a raw model response into the insights shape. */
function safeParseInsights(text: string | undefined): z.infer<typeof InsightsSchema> | null {
  if (!text) return null;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const result = InsightsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
