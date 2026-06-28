import { createFileRoute } from "@tanstack/react-router";
import { extractTransactions, type ExtractInput } from "@/lib/extract.server";
import { verifyRequestUser } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/extract-tx")({
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
        if (!key)
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
          });
        const body = (await request.json()) as ExtractInput;

        if (!body.text?.trim() && !body.imageDataUrl && !body.audio?.base64) {
          return new Response(JSON.stringify({ error: "empty" }), { status: 400 });
        }

        try {
          const transactions = await extractTransactions(body, key);
          return Response.json({ transactions });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: "gateway", detail: String(e?.message ?? e) }),
            { status: 502 },
          );
        }
      },
    },
  },
});
