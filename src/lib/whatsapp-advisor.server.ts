// ============================================================================
// "Meu Assessor" no WhatsApp — versão consultor financeiro.
// Reaproveita TODA a IA Financeira (finance-ai) sobre os dados salvos do
// usuário para responder perguntas naturais e comandos avançados (score,
// estabilidade, previsão, desperdícios) diretamente pelo WhatsApp.
// Só é importado pelo webhook do WhatsApp (server-only, sufixo .server).
// ============================================================================

import type { FinanceState, Transaction } from "./finance-store";
import {
  balanceForecast,
  buildFinanceContext,
  detectWaste,
  emergencyReserve,
  financialScore,
  referenceIncome,
  safeDailySpend,
  stabilityIndex,
} from "./finance-ai";
import { formatBRL } from "./format";

// ---------------------------------------------------------------------------
// Monta um FinanceState a partir do banco (via service role) para alimentar a
// IA Financeira no servidor. Campos só de UI recebem defaults inofensivos.
// ---------------------------------------------------------------------------

function mapTx(r: any): Transaction {
  return {
    id: r.id,
    kind: r.kind === "receita" ? "receita" : "despesa",
    amount: Number(r.amount) || 0,
    category: r.category ?? "Outros",
    description: r.description ?? "",
    date: r.date,
    paymentMethod: r.payment_method ?? undefined,
    cardId: r.card_id ?? undefined,
    installments: r.installments ?? undefined,
  };
}

export async function loadFinanceState(
  supabaseAdmin: any,
  userId: string,
): Promise<FinanceState> {
  const [tx, goals, cards, assets, debts, inst] = await Promise.all([
    supabaseAdmin
      .from("transactions")
      .select("id, kind, amount, category, description, date, payment_method, card_id, installments")
      .eq("user_id", userId),
    supabaseAdmin.from("goals").select("id, title, target, saved, deadline, emoji").eq("user_id", userId),
    supabaseAdmin
      .from("cards")
      .select("id, name, brand, limit, closing_day, due_day, color")
      .eq("user_id", userId),
    supabaseAdmin.from("assets").select("id, type, name, value").eq("user_id", userId),
    supabaseAdmin.from("debts").select("id, name, value").eq("user_id", userId),
    supabaseAdmin
      .from("installment_purchases")
      .select("id, name, total, installments, paid, card_id, category, date")
      .eq("user_id", userId),
  ]);

  return {
    userName: "",
    hideBalance: false,
    transactions: (tx.data ?? []).map(mapTx),
    cards: (cards.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      limit: Number(r.limit) || 0,
      closingDay: r.closing_day ?? 1,
      dueDay: r.due_day ?? 1,
      color: r.color || "",
    })),
    goals: (goals.data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      target: Number(r.target) || 0,
      saved: Number(r.saved) || 0,
      deadline: r.deadline ?? "",
      emoji: r.emoji || "🎯",
    })),
    installmentPurchases: (inst.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      total: Number(r.total) || 0,
      installments: r.installments ?? 1,
      paid: r.paid ?? 0,
      cardId: r.card_id ?? "",
      category: r.category ?? "Outros",
      date: r.date,
    })),
    assets: (assets.data ?? []).map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      value: Number(r.value) || 0,
    })),
    debts: (debts.data ?? []).map((r: any) => ({ id: r.id, name: r.name, value: Number(r.value) || 0 })),
    monthlyIncome: 0,
    installmentAlertPct: 30,
    onboardingDone: true,
    feedback: [],
    referralCode: "",
    dashboardPrefs: { showTips: true, showHealth: true, showCategories: true, showRecents: true },
    dismissedNotifs: [],
    cloudLoading: false,
  };
}

// ---------------------------------------------------------------------------
// Respostas de comandos avançados (sem IA — cálculo exato local).
// ---------------------------------------------------------------------------

export function scoreMessage(state: FinanceState): string {
  const sc = financialScore(state);
  if (sc.label === "Sem dados") {
    return "Ainda não tenho dados suficientes para calcular seu *Score financeiro*. Registre alguns gastos e receitas que eu monto sua análise. 😉";
  }
  const emoji = sc.tone === "ok" ? "🟢" : sc.tone === "warn" ? "🟡" : "🔴";
  return [
    `${emoji} *Score financeiro:* ${sc.score}/100 (${sc.label})`,
    "",
    "Composição:",
    `• Poupança: ${sc.breakdown.savings}/35`,
    `• Dívidas/parcelas: ${sc.breakdown.debt}/25`,
    `• Reserva: ${sc.breakdown.reserve}/25`,
    `• Consistência: ${sc.breakdown.consistency}/15`,
    "",
    "Quer um plano pra subir seu Score? É só perguntar. 💜",
  ].join("\n");
}

export function stabilityMessage(state: FinanceState): string {
  const st = stabilityIndex(state);
  if (st.label === "Sem dados") {
    return "Preciso de pelo menos 2 meses de movimentações para calcular seu *Índice de Estabilidade*. Continue registrando! 📈";
  }
  const emoji = st.index >= 50 ? "🟢" : st.index >= 30 ? "🟡" : "🔴";
  return `${emoji} *Índice de Estabilidade Financeira:* ${st.index}/100 (${st.label})\n\nEle mede o quanto sua renda e seus gastos são previsíveis e sustentáveis ao longo dos meses.`;
}

export function forecastMessage(state: FinanceState): string {
  const f = balanceForecast(state);
  const daily = safeDailySpend(state);
  const emoji = f.projectedBalance >= 0 ? "🟢" : "🔴";
  return [
    "🔮 *Previsão até o fim do mês*",
    "",
    `Gasto até agora: ${formatBRL(f.spentSoFar)}`,
    `Previsão de despesas: ${formatBRL(f.projectedExpense)}`,
    `${emoji} Saldo projetado: ${formatBRL(f.projectedBalance)}`,
    `Faltam ${f.daysRemaining} dias.`,
    "",
    `💡 Gasto diário seguro: *${formatBRL(daily)}/dia*`,
  ].join("\n");
}

export function wasteMessage(state: FinanceState): string {
  const waste = detectWaste(state);
  const reserve = emergencyReserve(state);
  if (waste.length === 0) {
    return "👏 Não encontrei desperdícios evidentes neste mês. Continue assim!\n\nQuer que eu sugira quanto guardar para sua reserva de emergência? É só perguntar.";
  }
  const lines = waste.map((w) => `• ${w.detail}`).join("\n");
  const reserveLine =
    reserve.target > 0
      ? `\n\n🛟 Reserva ideal: ${formatBRL(reserve.target)} (você tem ${formatBRL(reserve.current)}).`
      : "";
  return `🔎 *Onde dá pra economizar*\n\n${lines}${reserveLine}`;
}

// ---------------------------------------------------------------------------
// Conversa natural: responde perguntas do usuário como um consultor.
// Usa o gateway (chat completions) com o contexto financeiro real.
// ---------------------------------------------------------------------------

const ADVISOR_SYSTEM = `Você é o "Meu Assessor", consultor financeiro pessoal do app Finlux, respondendo pelo WhatsApp em português do Brasil.

Regras de conteúdo:
- Baseie-se EXCLUSIVAMENTE nos dados financeiros reais do usuário fornecidos no contexto (Score, Índice de Estabilidade, previsão de saldo, reserva, categorias, recorrências, metas). Nunca invente valores.
- Analise hábitos, preveja despesas e saldo, detecte desperdícios, aponte oportunidades, sugira economia e investimentos realistas, e ajude a criar/acompanhar metas.
- Se faltar dado, peça com simpatia e incentive registrar gastos.
- Nunca prometa rentabilidade garantida.

Estilo WhatsApp:
- Seja curto e direto: no máximo ~6 linhas. Nada de textão.
- Use *negrito do WhatsApp* (um asterisco) para números-chave. NÃO use markdown de app (#, **, tabelas, blocos de código).
- Tom empático, prático e humano. Pode usar 1–2 emojis.
- Sempre termine com um próximo passo acionável ou uma pergunta útil quando fizer sentido.`;

/** Chama o gateway e retorna a resposta do assessor em texto para o WhatsApp. */
export async function answerAdvisorQuestion(
  question: string,
  state: FinanceState,
  apiKey: string,
): Promise<string> {
  const context = buildFinanceContext(state);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `${ADVISOR_SYSTEM}\n\nContexto financeiro atual do usuário:\n${context}` },
        { role: "user", content: question.slice(0, 1000) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`gateway ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim()
    ? text.trim()
    : "Não consegui gerar uma análise agora. Tente novamente em instantes. 🙏";
}

/** Sanitiza a saída da IA para o formato WhatsApp (remove markdown de app). */
export function toWhatsappText(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "*$1*") // **negrito** -> *negrito*
    .replace(/^#{1,6}\s+/gm, "") // remove títulos markdown
    .replace(/`{1,3}/g, "") // remove crases
    .trim();
}
