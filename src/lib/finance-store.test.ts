import { describe, it, expect } from "vitest";
import {
  getMonthlySummary,
  getMonthlyHistory,
  getLevel,
  getAchievements,
  getChallenges,
  financialHealth,
  accountBalance,
  committedTotal,
  freeBalance,
  projectedBalance,
  cardInvoiceDue,
  type FinanceState,
  type Transaction,
} from "./finance-store";


function tx(partial: Partial<Transaction> & { kind: Transaction["kind"]; amount: number; date: string }): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    category: partial.category ?? "Outros",
    description: partial.description ?? "Teste",
    ...partial,
  } as Transaction;
}

function baseState(transactions: Transaction[]): FinanceState {
  return {
    transactions,
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
  } as unknown as FinanceState;
}

const NOW = new Date();
const iso = (year: number, monthOffset: number, day = 15) =>
  new Date(year, NOW.getMonth() + monthOffset, day).toISOString();

describe("getMonthlySummary", () => {
  it("computes income, expense and savings for the current month", () => {
    const state = baseState([
      tx({ kind: "receita", amount: 5000, date: iso(NOW.getFullYear(), 0) }),
      tx({ kind: "despesa", amount: 2000, date: iso(NOW.getFullYear(), 0), category: "Moradia" }),
      tx({ kind: "despesa", amount: 500, date: iso(NOW.getFullYear(), 0), category: "Lazer" }),
    ]);
    const s = getMonthlySummary(state);
    expect(s.income).toBe(5000);
    expect(s.expense).toBe(2500);
    expect(s.savings).toBe(2500);
    expect(s.byCategory[0].category).toBe("Moradia");
  });

  it("ignores transactions from other months", () => {
    const state = baseState([tx({ kind: "receita", amount: 999, date: iso(NOW.getFullYear(), -2) })]);
    expect(getMonthlySummary(state).income).toBe(0);
  });
});

describe("getMonthlyHistory", () => {
  it("returns the requested number of months ending in the current one", () => {
    const state = baseState([
      tx({ kind: "receita", amount: 100, date: iso(NOW.getFullYear(), 0) }),
      tx({ kind: "despesa", amount: 40, date: iso(NOW.getFullYear(), 0) }),
    ]);
    const history = getMonthlyHistory(state, 6);
    expect(history).toHaveLength(6);
    const last = history[history.length - 1];
    expect(last.income).toBe(100);
    expect(last.expense).toBe(40);
    expect(last.savings).toBe(60);
  });
});

describe("financialHealth", () => {
  it("flags healthy when saving 30%+", () => {
    expect(financialHealth({ income: 1000, expense: 600, savings: 400, balance: 400, committed: 0, free: 400, projected: 400, byCategory: [] }).tone).toBe("ok");
  });
  it("flags critical when overspending", () => {
    expect(financialHealth({ income: 1000, expense: 1200, savings: -200, balance: -200, committed: 0, free: -200, projected: -200, byCategory: [] }).tone).toBe("bad");

  });
});

describe("saldo x cartão de crédito", () => {
  const card = {
    id: "card-1",
    name: "Nubank",
    brand: "Visa",
    limit: 5000,
    closingDay: 28,
    dueDay: 5,
    color: "#000",
    debitMode: "on_payment" as const,
  };

  it("não desconta compras no cartão do saldo da conta", () => {
    const state = {
      ...baseState([
        tx({ kind: "receita", amount: 3000, date: iso(NOW.getFullYear(), 0, 1) }),
        tx({ kind: "despesa", amount: 500, date: iso(NOW.getFullYear(), 0, 1), cardId: "card-1" }),
        tx({ kind: "despesa", amount: 200, date: iso(NOW.getFullYear(), 0, 1) }),
      ]),
      cards: [card],
    };
    expect(accountBalance(state)).toBe(2800);
    expect(committedTotal(state)).toBe(500);
    expect(freeBalance(state)).toBe(2300);
  });

  it("desconta imediatamente quando o cartão é configurado assim", () => {
    const state = {
      ...baseState([
        tx({ kind: "receita", amount: 1000, date: iso(NOW.getFullYear(), 0, 1) }),
        tx({ kind: "despesa", amount: 400, date: iso(NOW.getFullYear(), 0, 1), cardId: "card-1" }),
      ]),
      cards: [{ ...card, debitMode: "immediate" as const }],
    };
    expect(accountBalance(state)).toBe(600);
    expect(committedTotal(state)).toBe(0);
  });

  it("não debita duas vezes: compra quitada + transação de pagamento da fatura", () => {
    const state = {
      ...baseState([
        tx({ kind: "receita", amount: 1000, date: iso(NOW.getFullYear(), 0, 1) }),
        { ...tx({ kind: "despesa", amount: 300, date: iso(NOW.getFullYear(), 0, 1), cardId: "card-1" }), invoicePaid: true },
        // débito real da conta é a transação de pagamento da fatura
        tx({ kind: "despesa", amount: 300, date: iso(NOW.getFullYear(), 0, 1), category: "Cartão de crédito" }),
      ]),
      cards: [card],
    };
    expect(accountBalance(state)).toBe(700);
    expect(committedTotal(state)).toBe(0);
  });

  it("despesa futura recorrente não reduz o saldo atual, apenas o comprometido", () => {
    const future = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 10).toISOString();
    const state = baseState([
      tx({ kind: "receita", amount: 3000, date: iso(NOW.getFullYear(), 0, 1) }),
      { ...tx({ kind: "despesa", amount: 1000, date: iso(NOW.getFullYear(), 0, 1) }), date: future },
    ]);
    expect(accountBalance(state, NOW)).toBe(3000);
    expect(committedTotal(state, NOW)).toBe(1000);
    expect(freeBalance(state, NOW)).toBe(2000);
    expect(projectedBalance(state, NOW)).toBe(2000);
  });


  it("soma compras e parcelas na fatura em aberto", () => {
    const state = {
      ...baseState([tx({ kind: "despesa", amount: 100, date: iso(NOW.getFullYear(), 0, 1), cardId: "card-1" })]),
      cards: [card],
    };
    const due = cardInvoiceDue(state, "card-1");
    expect(due.amount).toBe(100);
    expect(due.txIds).toHaveLength(1);
  });
});


describe("gamification", () => {
  it("unlocks the first transaction achievement", () => {
    const state = baseState([tx({ kind: "receita", amount: 10, date: iso(NOW.getFullYear(), 0, 1) })]);
    const first = getAchievements(state).find((a) => a.id === "first-tx");
    expect(first?.unlocked).toBe(true);
  });

  it("computes a level of at least 1 and a positive next threshold", () => {
    const level = getLevel(baseState([]));
    expect(level.level).toBeGreaterThanOrEqual(1);
    expect(level.nextXp).toBeGreaterThan(0);
  });

  it("returns a non-empty list of challenges", () => {
    expect(getChallenges(baseState([])).length).toBeGreaterThan(0);
  });
});
