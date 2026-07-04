// ============================================================================
// IA Financeira avançada — funções puras e testáveis usadas pelo Assistente,
// pelos Insights e pelo Dashboard. Tudo derivado do estado financeiro do
// usuário (nunca inventa valores). O "aprendizado contínuo" é feito sobre o
// histórico já salvo (sem novas tabelas).
// ============================================================================

import {
  getMonthlySummary,
  getMonthlyHistory,
  netWorth,
  installmentsByMonth,
  type FinanceState,
  type Transaction,
} from "./finance-store";
import { formatBRL } from "./format";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number): number {
  return Math.round(v);
}

/** Média mensal de despesas nos últimos `months` meses (ignora zeros à toa). */
function avgMonthlyExpense(state: FinanceState, months = 3, ref = new Date()): number {
  const hist = getMonthlyHistory(state, months, ref);
  if (hist.length === 0) return 0;
  const total = hist.reduce((a, p) => a + p.expense, 0);
  return total / hist.length;
}

/** Renda mensal de referência: usa a informada; senão, média das receitas recentes. */
export function referenceIncome(state: FinanceState, ref = new Date()): number {
  if (state.monthlyIncome > 0) return state.monthlyIncome;
  const hist = getMonthlyHistory(state, 3, ref).filter((p) => p.income > 0);
  if (hist.length === 0) return getMonthlySummary(state, ref).income;
  return hist.reduce((a, p) => a + p.income, 0) / hist.length;
}

// ---------------------------------------------------------------------------
// Previsão de saldo e despesas até o fim do mês
// ---------------------------------------------------------------------------

export interface BalanceForecast {
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  spentSoFar: number;
  dailyRate: number;
  projectedExpense: number;
  projectedSavings: number;
  /** Saldo geral projetado para o fim do mês. */
  projectedBalance: number;
  incomeSoFar: number;
}

export function balanceForecast(state: FinanceState, ref = new Date()): BalanceForecast {
  const summary = getMonthlySummary(state, ref);
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.min(daysInMonth, ref.getDate());
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const dailyRate = daysElapsed > 0 ? summary.expense / daysElapsed : 0;
  const projectedExpense = summary.expense + dailyRate * daysRemaining;
  const projectedSavings = summary.income - projectedExpense;
  const projectedBalance = summary.balance - dailyRate * daysRemaining;
  return {
    daysElapsed,
    daysInMonth,
    daysRemaining,
    spentSoFar: summary.expense,
    dailyRate,
    projectedExpense,
    projectedSavings,
    projectedBalance,
    incomeSoFar: summary.income,
  };
}

/** Quanto o usuário ainda pode gastar por dia mantendo a poupança do mês positiva. */
export function safeDailySpend(state: FinanceState, ref = new Date()): number {
  const f = balanceForecast(state, ref);
  const income = referenceIncome(state, ref);
  const remainingBudget = income - f.spentSoFar;
  if (f.daysRemaining <= 0) return Math.max(0, remainingBudget);
  return Math.max(0, remainingBudget / f.daysRemaining);
}

// ---------------------------------------------------------------------------
// Reserva de emergência
// ---------------------------------------------------------------------------

export interface EmergencyReserve {
  monthlyExpense: number;
  targetMonths: number;
  target: number;
  current: number;
  coverageMonths: number;
  pct: number;
}

export function emergencyReserve(state: FinanceState, targetMonths = 6, ref = new Date()): EmergencyReserve {
  const monthlyExpense = avgMonthlyExpense(state, 3, ref) || getMonthlySummary(state, ref).expense;
  const target = monthlyExpense * targetMonths;
  // "Reserva" = dinheiro em conta + investimentos líquidos.
  const current = state.assets
    .filter((a) => a.type === "conta" || a.type === "investimento")
    .reduce((sum, a) => sum + a.value, 0);
  const coverageMonths = monthlyExpense > 0 ? current / monthlyExpense : 0;
  const pct = target > 0 ? clamp((current / target) * 100) : 0;
  return { monthlyExpense, targetMonths, target, current, coverageMonths, pct };
}

// ---------------------------------------------------------------------------
// Score financeiro (0–100) — mais robusto que financialHealth
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  savings: number; // taxa de poupança
  debt: number; // comprometimento com dívidas/parcelas
  reserve: number; // reserva de emergência
  consistency: number; // consistência de registros/renda
}

export interface FinancialScore {
  score: number;
  label: "Excelente" | "Boa" | "Regular" | "Frágil" | "Sem dados";
  tone: "ok" | "warn" | "bad";
  breakdown: ScoreBreakdown;
}

export function financialScore(state: FinanceState, ref = new Date()): FinancialScore {
  const summary = getMonthlySummary(state, ref);
  const income = referenceIncome(state, ref);

  if (state.transactions.length === 0 || income <= 0) {
    return {
      score: 0,
      label: "Sem dados",
      tone: "warn",
      breakdown: { savings: 0, debt: 0, reserve: 0, consistency: 0 },
    };
  }

  // 1) Taxa de poupança (peso 35): 0% -> 0, 30%+ -> máximo.
  const savingsRate = income > 0 ? (summary.savings / income) * 100 : 0;
  const savings = clamp((savingsRate / 30) * 35, 0, 35);

  // 2) Comprometimento com parcelas/dívidas (peso 25): 0% ótimo, 40%+ ruim.
  const monthlyInst = installmentsByMonth(state, 1, undefined)[0]?.total ?? 0;
  const commitment = income > 0 ? (monthlyInst / income) * 100 : 0;
  const debt = clamp(25 - (commitment / 40) * 25, 0, 25);

  // 3) Reserva de emergência (peso 25): 6 meses -> máximo.
  const reserveInfo = emergencyReserve(state, 6, ref);
  const reserve = clamp((reserveInfo.coverageMonths / 6) * 25, 0, 25);

  // 4) Consistência de renda (peso 15): menor variação -> melhor.
  const hist = getMonthlyHistory(state, 4, ref).filter((p) => p.income > 0);
  let consistency = 8;
  if (hist.length >= 2) {
    const mean = hist.reduce((a, p) => a + p.income, 0) / hist.length;
    const variance = hist.reduce((a, p) => a + (p.income - mean) ** 2, 0) / hist.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    consistency = clamp(15 - cv * 30, 0, 15);
  }

  const score = round(clamp(savings + debt + reserve + consistency));
  let label: FinancialScore["label"];
  let tone: FinancialScore["tone"];
  if (score >= 75) [label, tone] = ["Excelente", "ok"];
  else if (score >= 55) [label, tone] = ["Boa", "ok"];
  else if (score >= 35) [label, tone] = ["Regular", "warn"];
  else [label, tone] = ["Frágil", "bad"];

  return {
    score,
    label,
    tone,
    breakdown: {
      savings: round(savings),
      debt: round(debt),
      reserve: round(reserve),
      consistency: round(consistency),
    },
  };
}

// ---------------------------------------------------------------------------
// Índice de Estabilidade Financeira (0–100)
// Mede o quanto a vida financeira é previsível e sustentável ao longo do tempo.
// ---------------------------------------------------------------------------

export function stabilityIndex(state: FinanceState, ref = new Date()): {
  index: number;
  label: "Muito estável" | "Estável" | "Instável" | "Muito instável" | "Sem dados";
} {
  const hist = getMonthlyHistory(state, 6, ref);
  const active = hist.filter((p) => p.income > 0 || p.expense > 0);
  if (active.length < 2) return { index: 0, label: "Sem dados" };

  // a) Meses no azul (saldo positivo) — sustentabilidade.
  const positiveMonths = active.filter((p) => p.savings >= 0).length;
  const sustainability = (positiveMonths / active.length) * 40;

  // b) Estabilidade da renda (baixa variação).
  const incomes = active.map((p) => p.income);
  const meanInc = incomes.reduce((a, v) => a + v, 0) / incomes.length;
  const cvInc =
    meanInc > 0
      ? Math.sqrt(incomes.reduce((a, v) => a + (v - meanInc) ** 2, 0) / incomes.length) / meanInc
      : 1;
  const incomeStability = clamp(30 - cvInc * 45, 0, 30);

  // c) Estabilidade das despesas (baixa variação).
  const expenses = active.map((p) => p.expense);
  const meanExp = expenses.reduce((a, v) => a + v, 0) / expenses.length;
  const cvExp =
    meanExp > 0
      ? Math.sqrt(expenses.reduce((a, v) => a + (v - meanExp) ** 2, 0) / expenses.length) / meanExp
      : 1;
  const expenseStability = clamp(30 - cvExp * 45, 0, 30);

  const index = round(clamp(sustainability + incomeStability + expenseStability));
  let label: ReturnType<typeof stabilityIndex>["label"];
  if (index >= 75) label = "Muito estável";
  else if (index >= 50) label = "Estável";
  else if (index >= 30) label = "Instável";
  else label = "Muito instável";
  return { index, label };
}

// ---------------------------------------------------------------------------
// Detecção de desperdícios e oportunidades de economia
// ---------------------------------------------------------------------------

export interface WasteFinding {
  category: string;
  detail: string;
  amount: number;
  tone: "warning" | "neutral";
}

export function detectWaste(state: FinanceState, ref = new Date()): WasteFinding[] {
  const out: WasteFinding[] = [];
  const summary = getMonthlySummary(state, ref);
  const hist = getMonthlyHistory(state, 4, ref);

  // 1) Assinaturas: costumam ser gasto recorrente "invisível".
  const subs = summary.byCategory.find((c) => c.category === "Assinaturas");
  if (subs && subs.total > 0) {
    out.push({
      category: "Assinaturas",
      detail: `Você gastou ${formatBRL(subs.total)} em assinaturas este mês. Revise serviços que não usa.`,
      amount: subs.total,
      tone: "warning",
    });
  }

  // 2) Categorias que cresceram vs. média dos meses anteriores.
  if (hist.length >= 3) {
    const previous = hist.slice(0, -1); // meses anteriores ao atual
    const catAvg = new Map<string, number>();
    for (const c of summary.byCategory) {
      // média histórica da categoria
      let sum = 0;
      let n = 0;
      for (const p of previous) {
        const monthTxs = txsForMonth(state, p);
        const catTotal = monthTxs
          .filter((t) => t.kind === "despesa" && t.category === c.category)
          .reduce((a, t) => a + t.amount, 0);
        sum += catTotal;
        n++;
      }
      const avg = n > 0 ? sum / n : 0;
      catAvg.set(c.category, avg);
      if (avg > 0 && c.total > avg * 1.4 && c.total - avg >= 50) {
        out.push({
          category: c.category,
          detail: `${c.category} subiu ${round(((c.total - avg) / avg) * 100)}% acima da sua média (${formatBRL(avg)}).`,
          amount: c.total - avg,
          tone: "warning",
        });
      }
    }
  }

  // 3) Concentração excessiva numa categoria.
  const top = summary.byCategory[0];
  if (top && summary.expense > 0 && top.total / summary.expense > 0.45) {
    out.push({
      category: top.category,
      detail: `${top.category} concentra ${round((top.total / summary.expense) * 100)}% dos gastos do mês.`,
      amount: top.total,
      tone: "neutral",
    });
  }

  return out.sort((a, b) => b.amount - a.amount).slice(0, 4);
}

function txsForMonth(state: FinanceState, point: { key: string }): Transaction[] {
  const [y, m] = point.key.split("-").map(Number);
  return state.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === y && d.getMonth() === m - 1;
  });
}

// ---------------------------------------------------------------------------
// Simulações: "posso comprar X?" e "quanto investir para atingir Y?"
// ---------------------------------------------------------------------------

export interface Affordability {
  price: number;
  verdict: "sim" | "com_cautela" | "nao";
  projectedSavings: number;
  reserveAfter: number;
  reason: string;
}

export function affordability(state: FinanceState, price: number, ref = new Date()): Affordability {
  const f = balanceForecast(state, ref);
  const reserve = emergencyReserve(state, 6, ref);
  const reserveAfter = reserve.current - price;
  const projectedSavings = f.projectedSavings;

  let verdict: Affordability["verdict"];
  let reason: string;

  if (price <= projectedSavings && projectedSavings > 0) {
    verdict = "sim";
    reason = `Cabe na sua economia projetada do mês (${formatBRL(projectedSavings)}) sem tocar na reserva.`;
  } else if (reserveAfter >= reserve.monthlyExpense * 3) {
    verdict = "com_cautela";
    reason = `Ultrapassa a economia do mês, mas ainda restariam ${formatBRL(reserveAfter)} de reserva (acima de 3 meses de gastos).`;
  } else {
    verdict = "nao";
    reason = `Comprometeria sua reserva de emergência: restariam apenas ${formatBRL(Math.max(0, reserveAfter))}. Vale planejar em parcelas de poupança.`;
  }

  return { price, verdict, projectedSavings, reserveAfter, reason };
}

/** Aporte mensal necessário para atingir uma meta.
 *  monthlyRate: taxa de juros mensal (ex.: 0.008 = 0,8% a.m.). Padrão: sem juros. */
export function monthlyInvestmentForGoal(
  target: number,
  months: number,
  currentSaved = 0,
  monthlyRate = 0,
): number {
  const remaining = Math.max(0, target - currentSaved);
  if (months <= 0) return remaining;
  if (monthlyRate <= 0) return remaining / months;
  // FV de anuidade: PMT = FV * i / ((1+i)^n - 1)
  const factor = Math.pow(1 + monthlyRate, months) - 1;
  return factor > 0 ? (remaining * monthlyRate) / factor : remaining / months;
}

// ---------------------------------------------------------------------------
// Aprendizado contínuo (via histórico): recorrências e frequências
// ---------------------------------------------------------------------------

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RecurringItem {
  description: string;
  category: string;
  kind: "receita" | "despesa";
  avgAmount: number;
  monthsSeen: number;
}

/** Detecta receitas/despesas recorrentes: mesma descrição em 2+ meses distintos. */
export function detectRecurring(state: FinanceState, ref = new Date()): RecurringItem[] {
  const groups = new Map<
    string,
    { description: string; category: string; kind: "receita" | "despesa"; months: Set<string>; total: number; count: number }
  >();

  for (const t of state.transactions) {
    const key = normalize(t.description || t.category);
    if (!key) continue;
    const d = new Date(t.date);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const g = groups.get(key) ?? {
      description: t.description || t.category,
      category: t.category,
      kind: t.kind,
      months: new Set<string>(),
      total: 0,
      count: 0,
    };
    g.months.add(monthKey);
    g.total += t.amount;
    g.count += 1;
    groups.set(key, g);
  }

  return Array.from(groups.values())
    .filter((g) => g.months.size >= 2)
    .map((g) => ({
      description: g.description,
      category: g.category,
      kind: g.kind,
      avgAmount: g.total / g.count,
      monthsSeen: g.months.size,
    }))
    .sort((a, b) => b.monthsSeen - a.monthsSeen || b.avgAmount - a.avgAmount)
    .slice(0, 8);
}

/** Categorias mais frequentes de despesa (para sugerir/preencher no registro). */
export function frequentCategories(state: FinanceState, limit = 5): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of state.transactions) {
    if (t.kind !== "despesa") continue;
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Sugestões dinâmicas de perguntas para o chat (baseadas nos dados reais).
// ---------------------------------------------------------------------------

const DEFAULT_SUGGESTIONS = [
  "Analise meus gastos do mês",
  "Onde estou desperdiçando dinheiro?",
  "Preveja meu saldo até o fim do mês",
  "Quanto devo guardar por mês?",
  "Como está meu Score financeiro?",
  "Que investimento faz sentido para mim?",
];

/** Gera perguntas rápidas contextualizadas pelo estado do usuário. Sempre
 *  retorna `limit` itens, completando com genéricas quando faltar contexto. */
export function suggestedQuestions(state: FinanceState, ref = new Date(), limit = 4): string[] {
  const out: string[] = [];

  if (state.transactions.length === 0) {
    return [
      "Como o Finlux pode me ajudar?",
      "Como registro meus gastos?",
      "O que é o Score financeiro?",
      "Como monto minha reserva de emergência?",
    ].slice(0, limit);
  }

  const score = financialScore(state, ref);
  const forecast = balanceForecast(state, ref);
  const reserve = emergencyReserve(state, 6, ref);
  const waste = detectWaste(state, ref);

  // 1) Desperdício em destaque.
  const topWaste = waste[0];
  if (topWaste) {
    out.push(`Como reduzir meus gastos com ${topWaste.category}?`);
  }

  // 2) Saldo projetado negativo — alerta prioritário.
  if (forecast.projectedBalance < 0) {
    out.push("Meu saldo vai ficar negativo? O que faço?");
  } else if (forecast.daysRemaining > 0) {
    out.push("Quanto posso gastar até o fim do mês?");
  }

  // 3) Reserva de emergência baixa.
  if (reserve.pct < 60) {
    out.push("Quanto preciso guardar para minha reserva de emergência?");
  }

  // 4) Score baixo/regular — pedir plano.
  if (score.label === "Regular" || score.label === "Frágil") {
    out.push("Como melhorar meu Score financeiro?");
  } else if (score.label !== "Sem dados") {
    out.push("Como está meu Score financeiro?");
  }

  // 5) Metas ativas — acompanhamento.
  if (state.goals.length > 0) {
    const g = state.goals[0];
    out.push(`Quanto investir por mês para atingir "${g.title}"?`);
  }

  // Completa com genéricas sem duplicar.
  for (const s of DEFAULT_SUGGESTIONS) {
    if (out.length >= limit) break;
    if (!out.includes(s)) out.push(s);
  }

  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Contexto rico para a IA (chat + insights) — consolida tudo acima.
// ---------------------------------------------------------------------------

export function buildFinanceContext(state: FinanceState, ref = new Date()): string {
  const s = getMonthlySummary(state, ref);
  const nw = netWorth(state);
  const score = financialScore(state, ref);
  const stability = stabilityIndex(state, ref);
  const forecast = balanceForecast(state, ref);
  const reserve = emergencyReserve(state, 6, ref);
  const daily = safeDailySpend(state, ref);
  const waste = detectWaste(state, ref);
  const recurring = detectRecurring(state, ref);
  const income = referenceIncome(state, ref);

  const cats = s.byCategory
    .slice(0, 6)
    .map((c) => `- ${c.category}: ${formatBRL(c.total)}`)
    .join("\n");

  const wasteLines = waste.map((w) => `- ${w.detail}`).join("\n");
  const recurringLines = recurring
    .slice(0, 5)
    .map((r) => `- ${r.description} (${r.kind}, ${r.category}): ~${formatBRL(r.avgAmount)}, visto em ${r.monthsSeen} meses`)
    .join("\n");

  const goalLines = state.goals
    .slice(0, 5)
    .map((g) => {
      const pct = g.target > 0 ? round((g.saved / g.target) * 100) : 0;
      return `- ${g.title}: ${formatBRL(g.saved)}/${formatBRL(g.target)} (${pct}%)${g.deadline ? `, prazo ${new Date(g.deadline).toLocaleDateString("pt-BR")}` : ""}`;
    })
    .join("\n");

  return [
    `Data de referência: ${ref.toLocaleDateString("pt-BR")}`,
    `Renda mensal de referência: ${formatBRL(income)}`,
    `Receitas do mês: ${formatBRL(s.income)}`,
    `Despesas do mês até agora: ${formatBRL(s.expense)}`,
    `Economia do mês: ${formatBRL(s.savings)}`,
    `Saldo geral: ${formatBRL(s.balance)}`,
    `Score financeiro: ${score.score}/100 (${score.label})`,
    `Índice de Estabilidade Financeira: ${stability.index}/100 (${stability.label})`,
    `Previsão de despesas até o fim do mês: ${formatBRL(forecast.projectedExpense)} (faltam ${forecast.daysRemaining} dias)`,
    `Saldo projetado para o fim do mês: ${formatBRL(forecast.projectedBalance)}`,
    `Gasto diário seguro sugerido: ${formatBRL(daily)}`,
    `Reserva de emergência: ${formatBRL(reserve.current)} de ${formatBRL(reserve.target)} recomendados (cobre ${reserve.coverageMonths.toFixed(1)} meses)`,
    `Patrimônio líquido: ${formatBRL(nw.net)} (ativos ${formatBRL(nw.assets)} / dívidas ${formatBRL(nw.debts)})`,
    `Total de transações: ${state.transactions.length}`,
    cats ? `Top categorias de despesa:\n${cats}` : "",
    wasteLines ? `Possíveis desperdícios/atenções:\n${wasteLines}` : "",
    recurringLines ? `Gastos/receitas recorrentes detectados:\n${recurringLines}` : "",
    goalLines ? `Metas ativas:\n${goalLines}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
