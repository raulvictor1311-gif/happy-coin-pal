import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type TxKind = "receita" | "despesa";

export interface Transaction {
  id: string;
  kind: TxKind;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO
  paymentMethod?: string;
  cardId?: string;
  installments?: number;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  saved: number;
  deadline: string; // ISO
  emoji: string;
}

export interface InstallmentPurchase {
  id: string;
  name: string;
  total: number;
  installments: number;
  paid: number; // quantas já foram pagas
  cardId: string;
  category: string;
  date: string; // ISO data da compra
}

export type AssetType = "conta" | "investimento" | "veiculo" | "imovel" | "outro";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  value: number;
}

export interface Debt {
  id: string;
  name: string;
  value: number;
}

export interface FeedbackEntry {
  id: string;
  score: number; // 0..10 NPS
  comment?: string;
  date: string;
}

export interface DashboardPrefs {
  showTips: boolean;
  showHealth: boolean;
  showCategories: boolean;
  showRecents: boolean;
}

export interface FinanceState {
  userName: string;
  transactions: Transaction[];
  cards: CreditCard[];
  goals: Goal[];
  hideBalance: boolean;
  installmentPurchases: InstallmentPurchase[];
  assets: Asset[];
  debts: Debt[];
  monthlyIncome: number;
  installmentAlertPct: number; // % da renda
  onboardingDone: boolean;
  feedback: FeedbackEntry[];
  referralCode: string;
  dashboardPrefs: DashboardPrefs;
  dismissedNotifs: string[];
  cloudLoading: boolean;
}

const STORAGE_KEY = "finlux:v2";

const DEFAULT_STATE: FinanceState = {
  userName: "",
  hideBalance: false,
  transactions: [],
  cards: [],
  goals: [],
  installmentPurchases: [],
  assets: [],
  debts: [],
  monthlyIncome: 0,
  installmentAlertPct: 30,
  onboardingDone: false,
  feedback: [],
  referralCode: "FINLUX-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
  dashboardPrefs: {
    showTips: true,
    showHealth: true,
    showCategories: true,
    showRecents: true,
  },
  dismissedNotifs: [],
  cloudLoading: false,
};


let state: FinanceState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function load() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function setState(updater: (s: FinanceState) => FinanceState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  load();
  return state;
}

function getServerSnapshot() {
  return DEFAULT_STATE;
}

export function useFinance() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ===== Sincronização com a nuvem (transações) =====

const TX_OWNER_KEY = "finlux:tx-owner";
let currentUserId: string | null = null;

/** Resolve o id do usuário logado (usa o cache, com fallback no Supabase Auth). */
async function resolveUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId;
  if (typeof window === "undefined") return null;
  try {
    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id ?? null;
  } catch {
    /* offline: segue só com o estado local */
  }
  return currentUserId;
}



interface TxRow {
  id: string;
  kind: string;
  amount: number | string;
  category: string;
  description: string;
  date: string;
  payment_method: string | null;
  card_id: string | null;
  installments: number | null;
}

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id,
    kind: r.kind === "receita" ? "receita" : "despesa",
    amount: Number(r.amount) || 0,
    category: r.category,
    description: r.description,
    date: r.date,
    paymentMethod: r.payment_method ?? undefined,
    cardId: r.card_id ?? undefined,
    installments: r.installments ?? undefined,
  };
}

function txToRow(t: Transaction, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    kind: t.kind,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: new Date(t.date).toISOString(),
    payment_method: t.paymentMethod ?? null,
    card_id: t.cardId ?? null,
    installments: t.installments ?? null,
  };
}

/** Chamado quando o estado de login muda. Sincroniza transações com a nuvem. */
export async function setCloudUser(userId: string | null) {
  load();
  currentUserId = userId;
  if (typeof window === "undefined") return;

  if (!userId) {
    // Logout: só limpa se antes havia um usuário logado de verdade neste
    // aparelho. Uso anônimo (nunca logado) mantém os dados locais.
    const prevOwner = localStorage.getItem(TX_OWNER_KEY);
    if (prevOwner && prevOwner !== "anon") {
      localStorage.setItem(TX_OWNER_KEY, "anon");
      setState((s) => ({ ...s, transactions: [] }));
    }
    return;
  }

  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, kind, amount, category, description, date, payment_method, card_id, installments")
      .eq("user_id", userId);
    if (error) throw error;

    const cloud = (data ?? []).map((r) => rowToTx(r as TxRow));
    const cloudIds = new Set(cloud.map((t) => t.id));

    // Importa transações locais (de uso anônimo) que ainda não estão na nuvem
    const prevOwner = localStorage.getItem(TX_OWNER_KEY);
    let localOnly: Transaction[] = [];
    if (prevOwner === null || prevOwner === "anon") {
      localOnly = state.transactions.filter((t) => !cloudIds.has(t.id));
      if (localOnly.length) {
        await supabase.from("transactions").insert(localOnly.map((t) => txToRow(t, userId)));
      }
    }

    const merged = [...localOnly, ...cloud].sort(
      (a, b) => +new Date(b.date) - +new Date(a.date),
    );
    setState((s) => ({ ...s, transactions: merged }));
    localStorage.setItem(TX_OWNER_KEY, userId);
  } catch {
    // Mantém o cache local em caso de falha de rede
  }
}


export const financeActions = {
  addTransaction(tx: Omit<Transaction, "id">): string {
    const id = crypto.randomUUID();
    const full: Transaction = { ...tx, id };
    setState((s) => ({ ...s, transactions: [full, ...s.transactions] }));
    if (currentUserId) {
      void supabase.from("transactions").insert(txToRow(full, currentUserId));
    }
    return id;
  },
  async removeTransaction(id: string) {
    // Garante a exclusão no banco ANTES de atualizar a UI, para não "ressuscitar"
    // a transação no próximo carregamento (F5).
    const uid = await resolveUserId();
    if (uid) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    }
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  },
  /** Apaga TODOS os dados financeiros do usuário (banco + estado + localStorage). */
  async resetAllData() {
    const uid = await resolveUserId();
    if (uid) {
      const { error } = await supabase.from("transactions").delete().eq("user_id", uid);
      if (error) throw error;
    }
    setState((s) => ({
      ...s,
      transactions: [],
      goals: [],
      installmentPurchases: [],
      assets: [],
      debts: [],
    }));
  },
  addCard(card: Omit<CreditCard, "id">) {
    setState((s) => ({ ...s, cards: [...s.cards, { ...card, id: crypto.randomUUID() }] }));
  },
  removeCard(id: string) {
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
  },
  addGoal(goal: Omit<Goal, "id">) {
    setState((s) => ({ ...s, goals: [...s.goals, { ...goal, id: crypto.randomUUID() }] }));
  },
  contributeGoal(id: string, amount: number) {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)),
    }));
  },
  removeGoal(id: string) {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  },
  toggleHideBalance() {
    setState((s) => ({ ...s, hideBalance: !s.hideBalance }));
  },
  setUserName(name: string) {
    setState((s) => ({ ...s, userName: name }));
  },
  addInstallment(p: Omit<InstallmentPurchase, "id" | "paid"> & { paid?: number }) {
    setState((s) => ({
      ...s,
      installmentPurchases: [
        { ...p, paid: p.paid ?? 0, id: crypto.randomUUID() },
        ...s.installmentPurchases,
      ],
    }));
  },
  payInstallment(id: string, qty = 1) {
    setState((s) => ({
      ...s,
      installmentPurchases: s.installmentPurchases.map((p) =>
        p.id === id ? { ...p, paid: Math.min(p.installments, p.paid + qty) } : p,
      ),
    }));
  },
  payOffInstallment(id: string) {
    setState((s) => ({
      ...s,
      installmentPurchases: s.installmentPurchases.map((p) =>
        p.id === id ? { ...p, paid: p.installments } : p,
      ),
    }));
  },
  removeInstallment(id: string) {
    setState((s) => ({ ...s, installmentPurchases: s.installmentPurchases.filter((p) => p.id !== id) }));
  },
  addAsset(a: Omit<Asset, "id">) {
    setState((s) => ({ ...s, assets: [...s.assets, { ...a, id: crypto.randomUUID() }] }));
  },
  removeAsset(id: string) {
    setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== id) }));
  },
  addDebt(d: Omit<Debt, "id">) {
    setState((s) => ({ ...s, debts: [...s.debts, { ...d, id: crypto.randomUUID() }] }));
  },
  removeDebt(id: string) {
    setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) }));
  },
  setMonthlyIncome(v: number) {
    setState((s) => ({ ...s, monthlyIncome: v }));
  },
  setInstallmentAlertPct(v: number) {
    setState((s) => ({ ...s, installmentAlertPct: v }));
  },
  completeOnboarding() {
    setState((s) => ({ ...s, onboardingDone: true }));
  },
  resetOnboarding() {
    setState((s) => ({ ...s, onboardingDone: false }));
  },
  addFeedback(score: number, comment?: string) {
    setState((s) => ({
      ...s,
      feedback: [
        { id: crypto.randomUUID(), score, comment, date: new Date().toISOString() },
        ...s.feedback,
      ],
    }));
  },
  toggleDashboardSection(key: keyof DashboardPrefs) {
    setState((s) => ({
      ...s,
      dashboardPrefs: { ...s.dashboardPrefs, [key]: !s.dashboardPrefs[key] },
    }));
  },
  dismissNotification(id: string) {
    setState((s) => ({ ...s, dismissedNotifs: [...new Set([...s.dismissedNotifs, id])] }));
  },
  clearDismissedNotifications() {
    setState((s) => ({ ...s, dismissedNotifs: [] }));
  },
};

// Derivations
export interface MonthlySummary {
  income: number;
  expense: number;
  savings: number;
  balance: number;
  byCategory: { category: string; total: number; color: string }[];
}

export const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "oklch(0.72 0.23 0)",
  Moradia: "oklch(0.7 0.18 250)",
  Transporte: "oklch(0.82 0.18 75)",
  Saúde: "oklch(0.78 0.17 155)",
  Educação: "oklch(0.7 0.18 200)",
  Lazer: "oklch(0.75 0.18 30)",
  Assinaturas: "oklch(0.7 0.2 300)",
  "Internet e telefone": "oklch(0.7 0.15 220)",
  Vestuário: "oklch(0.75 0.2 340)",
  Impostos: "oklch(0.7 0.05 260)",
  Salário: "oklch(0.78 0.17 155)",
  Outros: "oklch(0.65 0.02 270)",
};

export function colorForCategory(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "oklch(0.65 0.02 270)";
}

export function getMonthlySummary(s: FinanceState, ref = new Date()): MonthlySummary {
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const month = s.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });
  const income = month.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
  const expense = month.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
  const totalIncome = s.transactions.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
  const totalExpense = s.transactions.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const catMap = new Map<string, number>();
  for (const t of month.filter((t) => t.kind === "despesa")) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, total]) => ({ category, total, color: colorForCategory(category) }))
    .sort((a, b) => b.total - a.total);
  return { income, expense, savings: income - expense, balance, byCategory };
}

export function financialHealth(s: MonthlySummary): { score: number; label: string; tone: "ok" | "warn" | "bad" } {
  if (s.income === 0) return { score: 0, label: "Sem dados", tone: "warn" };
  const ratio = (s.income - s.expense) / s.income;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  if (score >= 30) return { score, label: "Saudável", tone: "ok" };
  if (score >= 10) return { score, label: "Atenção", tone: "warn" };
  return { score, label: "Crítico", tone: "bad" };
}

export const EXPENSE_CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Internet e telefone",
  "Vestuário",
  "Impostos",
  "Outros",
];

export const INCOME_CATEGORIES = [
  "Salário",
  "Freelance",
  "Comissão",
  "Rendimentos",
  "Outras receitas",
];

export const INSTALLMENT_CATEGORIES = [
  "Eletrônicos",
  "Casa",
  "Vestuário",
  "Viagem",
  "Saúde",
  "Educação",
  "Outros",
];

export const ASSET_LABELS: Record<AssetType, string> = {
  conta: "Dinheiro em conta",
  investimento: "Investimentos",
  veiculo: "Veículos",
  imovel: "Imóveis",
  outro: "Outros bens",
};

// ===== Installment helpers =====

export function installmentAmount(p: InstallmentPurchase): number {
  return p.installments > 0 ? p.total / p.installments : 0;
}

/** Retorna a data de vencimento da parcela número `i` (1-based). */
export function installmentDueDate(p: InstallmentPurchase, i: number, card?: CreditCard): Date {
  const d = new Date(p.date);
  const dueDay = card?.dueDay ?? d.getDate();
  // primeira parcela = mês seguinte à compra
  const target = new Date(d.getFullYear(), d.getMonth() + i, Math.min(dueDay, 28));
  return target;
}

export interface InstallmentEntry {
  purchaseId: string;
  name: string;
  number: number;
  total: number;
  amount: number;
  date: Date;
  paid: boolean;
  cardId: string;
  category: string;
}

export function getAllInstallmentEntries(s: FinanceState): InstallmentEntry[] {
  const out: InstallmentEntry[] = [];
  for (const p of s.installmentPurchases) {
    const card = s.cards.find((c) => c.id === p.cardId);
    const amount = installmentAmount(p);
    for (let i = 1; i <= p.installments; i++) {
      out.push({
        purchaseId: p.id,
        name: p.name,
        number: i,
        total: p.installments,
        amount,
        date: installmentDueDate(p, i, card),
        paid: i <= p.paid,
        cardId: p.cardId,
        category: p.category,
      });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function futureInstallmentsTotal(s: FinanceState, cardId?: string): number {
  return s.installmentPurchases
    .filter((p) => !cardId || p.cardId === cardId)
    .reduce((acc, p) => acc + installmentAmount(p) * (p.installments - p.paid), 0);
}

export function installmentsByMonth(
  s: FinanceState,
  monthsAhead = 6,
  cardId?: string,
): { key: string; label: string; total: number; date: Date }[] {
  const entries = getAllInstallmentEntries(s).filter(
    (e) => !e.paid && (!cardId || e.cardId === cardId),
  );
  const now = new Date();
  const buckets: { key: string; label: string; total: number; date: Date }[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const total = entries
      .filter((e) => e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth())
      .reduce((a, e) => a + e.amount, 0);
    buckets.push({ key, label, total, date: d });
  }
  return buckets;
}

/** Fatura atual do cartão = despesas no mês corrente + parcelas que vencem no mês corrente */
export function cardCurrentInvoice(s: FinanceState, cardId: string, ref = new Date()): number {
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const txs = s.transactions
    .filter((t) => t.cardId === cardId && t.kind === "despesa")
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    })
    .reduce((a, t) => a + t.amount, 0);
  const inst = getAllInstallmentEntries(s)
    .filter(
      (e) =>
        e.cardId === cardId && !e.paid && e.date.getMonth() === m && e.date.getFullYear() === y,
    )
    .reduce((a, e) => a + e.amount, 0);
  return txs + inst;
}

export function cardCommittedTotal(s: FinanceState, cardId: string): number {
  // usado para calcular limite disponível: tudo que ainda não foi pago
  const future = futureInstallmentsTotal(s, cardId);
  const txs = s.transactions
    .filter((t) => t.cardId === cardId && t.kind === "despesa")
    .reduce((a, t) => a + t.amount, 0);
  return future + txs;
}

// ===== Patrimônio =====

export function netWorth(s: FinanceState): { assets: number; debts: number; net: number } {
  const assets = s.assets.reduce((a, x) => a + x.value, 0);
  const debts = s.debts.reduce((a, x) => a + x.value, 0) + futureInstallmentsTotal(s);
  return { assets, debts, net: assets - debts };
}

// ===== Relatório mensal =====

export interface MonthlyReport extends MonthlySummary {
  ref: Date;
  topCategory?: { category: string; total: number };
  goalsProgress: { id: string; title: string; pct: number }[];
  insights: string[];
}

export function generateMonthlyReport(s: FinanceState, ref = new Date()): MonthlyReport {
  const summary = getMonthlySummary(s, ref);
  const topCategory = summary.byCategory[0];
  const goalsProgress = s.goals.map((g) => ({
    id: g.id,
    title: g.title,
    pct: g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0,
  }));
  const insights: string[] = [];
  if (summary.income > 0) {
    const rate = (summary.savings / summary.income) * 100;
    if (rate >= 20) insights.push(`Excelente! Você economizou ${rate.toFixed(0)}% da sua renda este mês.`);
    else if (rate >= 0) insights.push(`Você economizou ${rate.toFixed(0)}% da renda. Tente chegar a 20%.`);
    else insights.push(`Atenção: gastos superaram a renda em ${Math.abs(rate).toFixed(0)}%.`);
  }
  if (topCategory) {
    insights.push(`Maior gasto: ${topCategory.category} (${((topCategory.total / Math.max(1, summary.expense)) * 100).toFixed(0)}% das despesas).`);
  }
  const monthlyInstallment = installmentsByMonth(s, 1)[0]?.total ?? 0;
  if (monthlyInstallment > 0 && s.monthlyIncome > 0) {
    const pct = (monthlyInstallment / s.monthlyIncome) * 100;
    insights.push(`Parcelas comprometem ${pct.toFixed(0)}% da sua renda este mês.`);
  }
  return { ...summary, ref, topCategory, goalsProgress, insights };
}

// ===== Gamificação =====

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Sequência de dias consecutivos com pelo menos uma transação registrada,
 * terminando em hoje ou ontem. */
export function getStreak(s: FinanceState, ref = new Date()): number {
  const set = new Set(s.transactions.map((t) => dayKey(new Date(t.date))));
  if (set.size === 0) return 0;
  let streak = 0;
  const cur = new Date(ref);
  // se hoje não tem, começa de ontem
  if (!set.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  while (set.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: number; // 0..100
}

export function getAchievements(s: FinanceState): Achievement[] {
  const summary = getMonthlySummary(s);
  const streak = getStreak(s);
  const txCount = s.transactions.length;
  const goalsDone = s.goals.filter((g) => g.target > 0 && g.saved >= g.target).length;
  const savingsRate = summary.income > 0 ? (summary.savings / summary.income) * 100 : 0;
  const nw = netWorth(s);

  return [
    {
      id: "first-tx",
      title: "Primeira transação",
      description: "Registre sua primeira movimentação.",
      emoji: "🚀",
      unlocked: txCount >= 1,
      progress: Math.min(100, txCount * 100),
    },
    {
      id: "streak-7",
      title: "Semana em dia",
      description: "Registre algo por 7 dias seguidos.",
      emoji: "🔥",
      unlocked: streak >= 7,
      progress: Math.min(100, (streak / 7) * 100),
    },
    {
      id: "streak-30",
      title: "Mês consistente",
      description: "30 dias seguidos registrando.",
      emoji: "🏆",
      unlocked: streak >= 30,
      progress: Math.min(100, (streak / 30) * 100),
    },
    {
      id: "saver-20",
      title: "Poupador 20%",
      description: "Economize pelo menos 20% da renda no mês.",
      emoji: "💰",
      unlocked: savingsRate >= 20,
      progress: Math.min(100, (savingsRate / 20) * 100),
    },
    {
      id: "goal-done",
      title: "Meta batida",
      description: "Conclua uma meta financeira.",
      emoji: "🎯",
      unlocked: goalsDone >= 1,
    },
    {
      id: "patrimony-10k",
      title: "Primeiros 10 mil",
      description: "Atinja R$ 10.000 de patrimônio líquido.",
      emoji: "🌱",
      unlocked: nw.net >= 10000,
      progress: Math.min(100, (nw.net / 10000) * 100),
    },
  ];
}

/** Dicas inteligentes baseadas em comportamento. */
export function getSmartTips(s: FinanceState): string[] {
  const summary = getMonthlySummary(s);
  const tips: string[] = [];
  if (summary.income > 0) {
    const rate = (summary.savings / summary.income) * 100;
    if (rate < 0) tips.push("Seus gastos passaram da renda. Reveja categorias supérfluas.");
    else if (rate < 10) tips.push("Tente automatizar 10% da renda para a reserva de emergência.");
    else if (rate >= 30) tips.push("Ótima taxa de poupança! Considere investir o excedente.");
  }
  const top = summary.byCategory[0];
  if (top && summary.expense > 0 && top.total / summary.expense > 0.4) {
    tips.push(`${top.category} concentra mais de 40% dos gastos — vale revisar.`);
  }
  const monthlyInst = installmentsByMonth(s, 1)[0]?.total ?? 0;
  if (s.monthlyIncome > 0 && monthlyInst / s.monthlyIncome > s.installmentAlertPct / 100) {
    tips.push(`Parcelas passam de ${s.installmentAlertPct}% da renda — evite novas compras parceladas.`);
  }
  if (s.transactions.length === 0) {
    tips.push("Registre sua primeira receita ou despesa para começar a ver insights.");
  }
  return tips.slice(0, 3);
}

// ===== Desafios mensais =====

export interface Challenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  progress: number; // 0..100
  target: string;
  current: string;
  done: boolean;
}

export function getChallenges(s: FinanceState): Challenge[] {
  const summary = getMonthlySummary(s);
  const streak = getStreak(s);
  const savingsRate = summary.income > 0 ? (summary.savings / summary.income) * 100 : 0;
  const lazerSpend = summary.byCategory.find((c) => c.category === "Lazer")?.total ?? 0;
  const lazerLimit = Math.max(50, s.monthlyIncome * 0.1);
  const lazerUsed = Math.min(100, (lazerSpend / lazerLimit) * 100);

  return [
    {
      id: "streak-14",
      title: "14 dias de registros",
      description: "Registre uma movimentação por 14 dias seguidos.",
      emoji: "🔥",
      progress: Math.min(100, (streak / 14) * 100),
      target: "14 dias",
      current: `${streak} dias`,
      done: streak >= 14,
    },
    {
      id: "save-20",
      title: "Economize 20% da renda",
      description: "Termine o mês com pelo menos 20% de poupança.",
      emoji: "💸",
      progress: Math.min(100, (savingsRate / 20) * 100),
      target: "20%",
      current: `${Math.max(0, Math.round(savingsRate))}%`,
      done: savingsRate >= 20,
    },
    {
      id: "limit-lazer",
      title: "Lazer sob controle",
      description: `Mantenha o lazer abaixo de ${formatCompactBRLLocal(lazerLimit)} este mês.`,
      emoji: "🎯",
      progress: Math.min(100, lazerUsed),
      target: formatCompactBRLLocal(lazerLimit),
      current: formatCompactBRLLocal(lazerSpend),
      done: lazerSpend > 0 && lazerSpend <= lazerLimit,
    },
  ];
}

function formatCompactBRLLocal(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${v.toFixed(0)}`;
}

// ===== Nível do usuário =====

export function getLevel(s: FinanceState): { level: number; xp: number; nextXp: number; title: string } {
  const ach = getAchievements(s);
  const unlocked = ach.filter((a) => a.unlocked).length;
  const xp = unlocked * 100 + getStreak(s) * 10 + s.transactions.length * 5;
  const level = Math.max(1, Math.floor(xp / 200) + 1);
  const nextXp = level * 200;
  const titles = ["Iniciante", "Explorador", "Organizado", "Disciplinado", "Estrategista", "Mestre"];
  return { level, xp, nextXp, title: titles[Math.min(level - 1, titles.length - 1)] };
}

// ===== Central de notificações =====

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  emoji: string;
  tone: "info" | "warn" | "success";
}

export function getNotifications(s: FinanceState): AppNotification[] {
  const out: AppNotification[] = [];
  const summary = getMonthlySummary(s);
  const monthlyInst = installmentsByMonth(s, 1)[0]?.total ?? 0;

  if (s.monthlyIncome > 0 && monthlyInst / s.monthlyIncome > s.installmentAlertPct / 100) {
    out.push({
      id: "alert-installments",
      title: "Parcelas acima do limite",
      body: `Suas parcelas deste mês passam de ${s.installmentAlertPct}% da renda.`,
      emoji: "⚠️",
      tone: "warn",
    });
  }
  if (summary.income > 0 && summary.savings < 0) {
    out.push({
      id: "alert-overspend",
      title: "Gastos acima da renda",
      body: "Você gastou mais do que recebeu este mês.",
      emoji: "🚨",
      tone: "warn",
    });
  }
  const top = summary.byCategory[0];
  if (top && summary.expense > 0 && top.total / summary.expense > 0.4) {
    out.push({
      id: `alert-top-${top.category}`,
      title: `Atenção com ${top.category}`,
      body: `${top.category} representa ${Math.round((top.total / summary.expense) * 100)}% das suas despesas.`,
      emoji: "📊",
      tone: "info",
    });
  }
  const goalsDone = s.goals.filter((g) => g.target > 0 && g.saved >= g.target);
  for (const g of goalsDone) {
    out.push({
      id: `goal-done-${g.id}`,
      title: "Meta concluída! 🎉",
      body: `Você atingiu sua meta "${g.title}".`,
      emoji: g.emoji || "🎯",
      tone: "success",
    });
  }
  for (const card of s.cards) {
    const invoice = cardCurrentInvoice(s, card.id);
    if (invoice > 0 && card.limit > 0 && invoice / card.limit > 0.8) {
      out.push({
        id: `card-${card.id}-high`,
        title: `Fatura alta — ${card.name}`,
        body: `A fatura atual usa mais de 80% do limite.`,
        emoji: "💳",
        tone: "warn",
      });
    }
  }

  return out.filter((n) => !s.dismissedNotifs.includes(n.id));
}