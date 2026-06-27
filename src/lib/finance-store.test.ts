import { describe, it, expect } from "vitest";
import {
  getMonthlySummary,
  getMonthlyHistory,
  getLevel,
  getAchievements,
  getChallenges,
  financialHealth,
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
    expect(financialHealth({ income: 1000, expense: 600, savings: 400, balance: 400, byCategory: [] }).tone).toBe("ok");
  });
  it("flags critical when overspending", () => {
    expect(financialHealth({ income: 1000, expense: 1200, savings: -200, balance: -200, byCategory: [] }).tone).toBe("bad");
  });
});

describe("gamification", () => {
  it("unlocks the first transaction achievement", () => {
    const state = baseState([tx({ kind: "receita", amount: 10, date: iso(NOW.getFullYear(), 0) })]);
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
