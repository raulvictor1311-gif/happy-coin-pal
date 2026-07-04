import { describe, it, expect } from "vitest";
import {
  balanceForecast,
  safeDailySpend,
  emergencyReserve,
  financialScore,
  stabilityIndex,
  detectWaste,
  affordability,
  monthlyInvestmentForGoal,
  detectRecurring,
  frequentCategories,
  suggestCategoryFromHistory,
  suggestedQuestions,
  buildFinanceContext,
} from "./finance-ai";
import { type FinanceState, type Transaction, type Asset } from "./finance-store";

function tx(partial: Partial<Transaction> & { kind: Transaction["kind"]; amount: number; date: string }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    category: partial.category ?? "Outros",
    description: partial.description ?? "Teste",
    ...partial,
  } as Transaction;
}

function baseState(over: Partial<FinanceState> = {}): FinanceState {
  return {
    transactions: [],
    goals: [],
    cards: [],
    assets: [],
    debts: [],
    installmentPurchases: [],
    monthlyIncome: 0,
    installmentAlertPct: 30,
    userName: "Teste",
    hideBalance: false,
    onboardingDone: true,
    dismissedNotifications: [],
    dashboardPrefs: { showHealth: true, showTips: true, showCategories: true, showRecents: true },
    ...over,
  } as unknown as FinanceState;
}

const Y = new Date().getFullYear();
// Data no dia 1 do mês corrente, garante muitos dias restantes para previsão.
function thisMonth(day: number, monthOffset = 0) {
  return new Date(Y, new Date().getMonth() + monthOffset, day).toISOString();
}

describe("balanceForecast", () => {
  it("projeta despesa maior que a gasta até agora quando há dias restantes", () => {
    const ref = new Date(Y, new Date().getMonth(), 10);
    const state = baseState({
      transactions: [
        tx({ kind: "receita", amount: 5000, date: thisMonth(1) }),
        tx({ kind: "despesa", amount: 1000, date: thisMonth(5), category: "Alimentação" }),
      ],
    });
    const f = balanceForecast(state, ref);
    expect(f.spentSoFar).toBe(1000);
    expect(f.projectedExpense).toBeGreaterThan(1000);
    expect(f.daysRemaining).toBeGreaterThan(0);
  });
});

describe("safeDailySpend", () => {
  it("é não negativo", () => {
    const state = baseState({ monthlyIncome: 3000 });
    expect(safeDailySpend(state, new Date(Y, new Date().getMonth(), 10))).toBeGreaterThanOrEqual(0);
  });
});

describe("emergencyReserve", () => {
  it("soma conta + investimentos como reserva atual", () => {
    const assets: Asset[] = [
      { id: "1", type: "conta", name: "Conta", value: 3000 },
      { id: "2", type: "investimento", name: "CDB", value: 2000 },
      { id: "3", type: "veiculo", name: "Carro", value: 40000 },
    ];
    const state = baseState({
      assets,
      transactions: [tx({ kind: "despesa", amount: 1000, date: thisMonth(5) })],
    });
    const r = emergencyReserve(state, 6);
    expect(r.current).toBe(5000);
  });
});

describe("financialScore", () => {
  it("retorna 'Sem dados' sem transações", () => {
    expect(financialScore(baseState()).label).toBe("Sem dados");
  });
  it("pontua melhor quem poupa e tem reserva", () => {
    const good = baseState({
      monthlyIncome: 5000,
      assets: [{ id: "1", type: "conta", name: "c", value: 30000 }],
      transactions: [
        tx({ kind: "receita", amount: 5000, date: thisMonth(2) }),
        tx({ kind: "despesa", amount: 1000, date: thisMonth(3), category: "Moradia" }),
      ],
    });
    const bad = baseState({
      monthlyIncome: 5000,
      transactions: [
        tx({ kind: "receita", amount: 5000, date: thisMonth(2) }),
        tx({ kind: "despesa", amount: 5200, date: thisMonth(3), category: "Lazer" }),
      ],
    });
    expect(financialScore(good).score).toBeGreaterThan(financialScore(bad).score);
  });
});

describe("stabilityIndex", () => {
  it("retorna sem dados com histórico insuficiente", () => {
    expect(stabilityIndex(baseState()).label).toBe("Sem dados");
  });
});

describe("detectWaste", () => {
  it("sinaliza assinaturas", () => {
    const state = baseState({
      transactions: [
        tx({ kind: "despesa", amount: 200, date: thisMonth(5), category: "Assinaturas" }),
      ],
    });
    const w = detectWaste(state);
    expect(w.some((x) => x.category === "Assinaturas")).toBe(true);
  });
});

describe("affordability", () => {
  it("aprova compra que cabe na economia projetada", () => {
    const ref = new Date(Y, new Date().getMonth(), 2);
    const state = baseState({
      monthlyIncome: 10000,
      transactions: [
        tx({ kind: "receita", amount: 10000, date: thisMonth(1) }),
      ],
    });
    expect(affordability(state, 100, ref).verdict).toBe("sim");
  });
  it("recusa compra que estoura a reserva", () => {
    const state = baseState({
      monthlyIncome: 2000,
      transactions: [
        tx({ kind: "receita", amount: 2000, date: thisMonth(1) }),
        tx({ kind: "despesa", amount: 1900, date: thisMonth(2), category: "Moradia" }),
      ],
    });
    expect(affordability(state, 50000).verdict).toBe("nao");
  });
});

describe("monthlyInvestmentForGoal", () => {
  it("divide igualmente sem juros", () => {
    expect(monthlyInvestmentForGoal(1200, 12, 0, 0)).toBe(100);
  });
  it("desconta o já poupado", () => {
    expect(monthlyInvestmentForGoal(1200, 10, 200, 0)).toBe(100);
  });
  it("com juros exige aporte menor que sem juros", () => {
    const semJuros = monthlyInvestmentForGoal(100000, 60, 0, 0);
    const comJuros = monthlyInvestmentForGoal(100000, 60, 0, 0.008);
    expect(comJuros).toBeLessThan(semJuros);
  });
});

describe("detectRecurring", () => {
  it("detecta despesa recorrente em meses distintos", () => {
    const state = baseState({
      transactions: [
        tx({ kind: "despesa", amount: 50, date: thisMonth(10, -1), description: "Netflix", category: "Assinaturas" }),
        tx({ kind: "despesa", amount: 50, date: thisMonth(10, 0), description: "netflix", category: "Assinaturas" }),
      ],
    });
    const rec = detectRecurring(state);
    expect(rec.some((r) => r.description.toLowerCase().includes("netflix"))).toBe(true);
  });
});

describe("frequentCategories", () => {
  it("ordena por frequência", () => {
    const state = baseState({
      transactions: [
        tx({ kind: "despesa", amount: 10, date: thisMonth(1), category: "Alimentação" }),
        tx({ kind: "despesa", amount: 10, date: thisMonth(2), category: "Alimentação" }),
        tx({ kind: "despesa", amount: 10, date: thisMonth(3), category: "Lazer" }),
      ],
    });
    expect(frequentCategories(state)[0].category).toBe("Alimentação");
  });
});

describe("suggestedQuestions", () => {
  it("retorna sugestões de onboarding sem transações", () => {
    const q = suggestedQuestions(baseState());
    expect(q.length).toBe(4);
    expect(q.some((s) => s.toLowerCase().includes("registro"))).toBe(true);
  });
  it("sugere reduzir a categoria de desperdício detectada", () => {
    const state = baseState({
      monthlyIncome: 3000,
      transactions: [
        tx({ kind: "receita", amount: 3000, date: thisMonth(1) }),
        tx({ kind: "despesa", amount: 300, date: thisMonth(3), category: "Assinaturas" }),
      ],
    });
    const q = suggestedQuestions(state);
    expect(q.some((s) => s.includes("Assinaturas"))).toBe(true);
  });
  it("nunca retorna itens duplicados", () => {
    const state = baseState({
      monthlyIncome: 5000,
      goals: [{ id: "g", title: "Viagem", target: 10000, saved: 1000, deadline: thisMonth(28, 6), emoji: "✈️" }],
      transactions: [tx({ kind: "receita", amount: 5000, date: thisMonth(1) })],
    });
    const q = suggestedQuestions(state);
    expect(new Set(q).size).toBe(q.length);
  });
});

describe("buildFinanceContext", () => {
  it("inclui score e estabilidade no texto", () => {
    const state = baseState({
      monthlyIncome: 3000,
      transactions: [tx({ kind: "receita", amount: 3000, date: thisMonth(1) })],
    });
    const ctx = buildFinanceContext(state);
    expect(ctx).toContain("Score financeiro");
    expect(ctx).toContain("Índice de Estabilidade");
  });
});
