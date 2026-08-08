import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_NOTIF_PREFS,
  type NotifCategory,
  type NotifMeta,
  type NotifPrefs,
} from "@/lib/notifications";

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
  /** Compra no cartão já quitada via pagamento de fatura. */
  invoicePaid?: boolean;
}

/** Quando a compra no cartão sai do saldo da conta. */
export type DebitMode = "on_payment" | "on_due" | "immediate";

export const DEBIT_MODE_LABELS: Record<DebitMode, string> = {
  on_payment: "Ao pagar a fatura",
  on_due: "No vencimento da fatura",
  immediate: "Imediatamente",
};

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
  debitMode: DebitMode;
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
  /** Preferências da central de notificações. */
  notifPrefs: NotifPrefs;
  /** Estado por notificação: lida, favorita, arquivada. */
  notifMeta: Record<string, NotifMeta>;
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
  notifPrefs: DEFAULT_NOTIF_PREFS,
  notifMeta: {},
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
    if (raw) {
      const saved = JSON.parse(raw) as Partial<FinanceState>;
      state = {
        ...DEFAULT_STATE,
        ...saved,
        notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...(saved.notifPrefs ?? {}) },
        notifMeta: saved.notifMeta ?? {},
        cloudLoading: false,
      };
    }
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

// ===== Sincronização com a nuvem =====

const OWNER_KEY = "finlux:owner";
let currentUserId: string | null = null;

type TableName =
  | "transactions"
  | "goals"
  | "cards"
  | "assets"
  | "debts"
  | "installment_purchases";

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

function notifyError(msg: string) {
  if (typeof window !== "undefined") toast.error(msg);
}

/** Insere uma linha na nuvem (best-effort). Em caso de falha, o item permanece
 * no estado local e será reconciliado no próximo carregamento. */
async function cloudInsert(table: TableName, row: Record<string, unknown>) {
  if (!currentUserId) return;
  try {
    const { error } = await (supabase.from(table) as any).insert(row);
    if (error) throw error;
  } catch {
    notifyError("Não foi possível salvar na nuvem. Verifique sua conexão.");
  }
}

async function cloudUpdate(table: TableName, id: string, patch: Record<string, unknown>) {
  if (!currentUserId) return;
  try {
    const { error } = await (supabase.from(table) as any)
      .update(patch)
      .eq("id", id)
      .eq("user_id", currentUserId);
    if (error) throw error;
  } catch {
    notifyError("Não foi possível salvar a alteração na nuvem.");
  }
}

async function cloudDelete(table: TableName, id: string) {
  if (!currentUserId) return;
  try {
    const { error } = await (supabase.from(table) as any)
      .delete()
      .eq("id", id)
      .eq("user_id", currentUserId);
    if (error) throw error;
  } catch {
    notifyError("Não foi possível remover na nuvem.");
  }
}

// ----- Mapeadores linha <-> objeto -----

function rowToTx(r: any): Transaction {
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
    invoicePaid: r.invoice_paid ?? false,
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
    invoice_paid: t.invoicePaid ?? false,
  };
}


function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    title: r.title,
    target: Number(r.target) || 0,
    saved: Number(r.saved) || 0,
    deadline: r.deadline ?? "",
    emoji: r.emoji || "🎯",
  };
}
function goalToRow(g: Goal, userId: string) {
  return {
    id: g.id,
    user_id: userId,
    title: g.title,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline ? new Date(g.deadline).toISOString() : null,
    emoji: g.emoji,
  };
}

function rowToCard(r: any): CreditCard {
  const mode = r.debit_mode;
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    limit: Number(r.limit) || 0,
    closingDay: r.closing_day ?? 1,
    dueDay: r.due_day ?? 1,
    color: r.color || "",
    debitMode: mode === "on_due" || mode === "immediate" ? mode : "on_payment",
  };
}
function cardToRow(c: CreditCard, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    brand: c.brand,
    limit: c.limit,
    closing_day: c.closingDay,
    due_day: c.dueDay,
    color: c.color,
    debit_mode: c.debitMode ?? "on_payment",
  };
}


function rowToAsset(r: any): Asset {
  return { id: r.id, type: r.type, name: r.name, value: Number(r.value) || 0 };
}
function assetToRow(a: Asset, userId: string) {
  return { id: a.id, user_id: userId, type: a.type, name: a.name, value: a.value };
}

function rowToDebt(r: any): Debt {
  return { id: r.id, name: r.name, value: Number(r.value) || 0 };
}
function debtToRow(d: Debt, userId: string) {
  return { id: d.id, user_id: userId, name: d.name, value: d.value };
}

function rowToInstallment(r: any): InstallmentPurchase {
  return {
    id: r.id,
    name: r.name,
    total: Number(r.total) || 0,
    installments: r.installments ?? 1,
    paid: r.paid ?? 0,
    cardId: r.card_id ?? "",
    category: r.category,
    date: r.date,
  };
}
function installmentToRow(p: InstallmentPurchase, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    total: p.total,
    installments: p.installments,
    paid: p.paid,
    card_id: p.cardId || null,
    category: p.category,
    date: new Date(p.date).toISOString(),
  };
}

/** Busca uma tabela na nuvem e reconcilia com itens locais ainda não enviados. */
async function pullAndReconcile<T extends { id: string }>(
  table: TableName,
  select: string,
  uid: string,
  rowToItem: (r: any) => T,
  itemToRow: (t: T, uid: string) => Record<string, unknown>,
  local: T[],
  importLocal: boolean,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(select).eq("user_id", uid);
  if (error) throw error;
  const cloud = (data ?? []).map(rowToItem);
  const cloudIds = new Set(cloud.map((c) => c.id));
  let localOnly: T[] = [];
  if (importLocal) {
    localOnly = local.filter((l) => !cloudIds.has(l.id));
    if (localOnly.length) {
      await (supabase.from(table) as any).insert(localOnly.map((l) => itemToRow(l, uid)));
    }
  }
  return [...localOnly, ...cloud];
}

/** Puxa TODAS as tabelas da nuvem e devolve um patch de estado.
 *  Quando `importLocal` é true, também envia itens locais ainda não sincronizados. */
async function pullAll(userId: string, importLocal: boolean, snap: FinanceState) {
  const [transactions, goals, cards, assets, debts, installmentPurchases] = await Promise.all([
    pullAndReconcile<Transaction>(
      "transactions",
      "id, kind, amount, category, description, date, payment_method, card_id, installments",
      userId, rowToTx, txToRow, snap.transactions, importLocal,
    ),
    pullAndReconcile<Goal>(
      "goals", "id, title, target, saved, deadline, emoji",
      userId, rowToGoal, goalToRow, snap.goals, importLocal,
    ),
    pullAndReconcile<CreditCard>(
      "cards", "id, name, brand, limit, closing_day, due_day, color",
      userId, rowToCard, cardToRow, snap.cards, importLocal,
    ),
    pullAndReconcile<Asset>(
      "assets", "id, type, name, value",
      userId, rowToAsset, assetToRow, snap.assets, importLocal,
    ),
    pullAndReconcile<Debt>(
      "debts", "id, name, value",
      userId, rowToDebt, debtToRow, snap.debts, importLocal,
    ),
    pullAndReconcile<InstallmentPurchase>(
      "installment_purchases", "id, name, total, installments, paid, card_id, category, date",
      userId, rowToInstallment, installmentToRow, snap.installmentPurchases, importLocal,
    ),
  ]);
  transactions.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { transactions, goals, cards, assets, debts, installmentPurchases };
}

// ----- Realtime: reflete no app qualquer mudança feita pela nuvem (ex.: WhatsApp) -----

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;

function teardownRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function setupRealtime(userId: string) {
  teardownRealtime();
  const tables: TableName[] = [
    "transactions", "goals", "cards", "assets", "debts", "installment_purchases",
  ];
  const channel = supabase.channel(`finance:${userId}`);
  for (const table of tables) {
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
      () => scheduleRefresh(),
    );
  }
  channel.subscribe();
  realtimeChannel = channel;
}

/** Reexecuta o pull da nuvem (debounced) sem reimportar itens locais.
 *  Usado pelo realtime e ao voltar o foco para o app. */
export function scheduleRefresh(delay = 400) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refreshFromCloud(), delay);
}

export async function refreshFromCloud() {
  if (!currentUserId || refreshing || typeof window === "undefined") return;
  refreshing = true;
  try {
    const patch = await pullAll(currentUserId, false, state);
    setState((s) => ({ ...s, ...patch }));
  } catch {
    /* mantém o cache local em caso de falha de rede */
  } finally {
    refreshing = false;
  }
}

/** Chamado quando o estado de login muda. Sincroniza TODOS os dados com a nuvem. */
export async function setCloudUser(userId: string | null) {
  load();
  currentUserId = userId;
  if (typeof window === "undefined") return;

  if (!userId) {
    teardownRealtime();
    // Logout: limpa dados sensíveis se antes havia um usuário real neste aparelho.
    // Uso anônimo (nunca logado) mantém os dados locais.
    const prevOwner = localStorage.getItem(OWNER_KEY);
    if (prevOwner && prevOwner !== "anon") {
      localStorage.setItem(OWNER_KEY, "anon");
      setState((s) => ({
        ...s,
        transactions: [],
        goals: [],
        cards: [],
        assets: [],
        debts: [],
        installmentPurchases: [],
      }));
    }
    return;
  }

  // Importa dados locais somente quando eram anônimos ou do mesmo usuário.
  // Nunca envia dados de OUTRO usuário (evita vazamento entre contas).
  const prevOwner = localStorage.getItem(OWNER_KEY);
  const importLocal = prevOwner === null || prevOwner === "anon" || prevOwner === userId;

  setState((s) => ({ ...s, cloudLoading: true }));
  try {
    const patch = await pullAll(userId, importLocal, state);
    setState((s) => ({ ...s, ...patch, cloudLoading: false }));
    localStorage.setItem(OWNER_KEY, userId);
    setupRealtime(userId);
  } catch {
    // Mantém o cache local em caso de falha de rede
    setState((s) => ({ ...s, cloudLoading: false }));
  }
}


export const financeActions = {
  addTransaction(tx: Omit<Transaction, "id">): string {
    const id = crypto.randomUUID();
    const full: Transaction = { ...tx, id };
    setState((s) => ({ ...s, transactions: [full, ...s.transactions] }));
    if (currentUserId) void cloudInsert("transactions", txToRow(full, currentUserId));
    return id;
  },
  /** Edita campos de uma transação existente (estado + nuvem). */
  updateTransaction(
    id: string,
    patch: Partial<Pick<Transaction, "kind" | "amount" | "category" | "description" | "date">>,
  ) {
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    const row: Record<string, unknown> = {};
    if (patch.kind !== undefined) row['kind'] = patch.kind;
    if (patch.amount !== undefined) row['amount'] = patch.amount;
    if (patch.category !== undefined) row['category'] = patch.category;
    if (patch.description !== undefined) row['description'] = patch.description;
    if (patch.date !== undefined) row['date'] = new Date(patch.date).toISOString();
    if (Object.keys(row).length > 0) void cloudUpdate("transactions", id, row);
  },
  async removeTransaction(id: string) {
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
      const tables: TableName[] = [
        "transactions", "goals", "cards", "assets", "debts", "installment_purchases",
      ];
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq("user_id", uid);
        if (error) throw error;
      }
    }
    setState((s) => ({
      ...s,
      transactions: [],
      goals: [],
      cards: [],
      installmentPurchases: [],
      assets: [],
      debts: [],
    }));
  },
  addCard(card: Omit<CreditCard, "id">) {
    const full: CreditCard = { ...card, id: crypto.randomUUID() };
    setState((s) => ({ ...s, cards: [...s.cards, full] }));
    if (currentUserId) void cloudInsert("cards", cardToRow(full, currentUserId));
  },
  setCardDebitMode(id: string, debitMode: DebitMode) {
    setState((s) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === id ? { ...c, debitMode } : c)),
    }));
    void cloudUpdate("cards", id, { debit_mode: debitMode });
  },
  /** Paga a fatura do cartão: debita o valor do saldo e quita compras e parcelas. */
  payCardInvoice(cardId: string, ref = new Date()): number {
    const snapshot = state;
    const card = snapshot.cards.find((c) => c.id === cardId);
    const due = cardInvoiceDue(snapshot, cardId, ref);
    if (!card || due.amount <= 0) return 0;

    financeActions.addTransaction({
      kind: "despesa",
      amount: due.amount,
      category: "Cartão de crédito",
      description: `Pagamento da fatura • ${card.name}`,
      date: new Date().toISOString(),
      paymentMethod: "fatura",
    });

    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) =>
        due.txIds.includes(t.id) ? { ...t, invoicePaid: true } : t,
      ),
    }));
    for (const id of due.txIds) void cloudUpdate("transactions", id, { invoice_paid: true });
    for (const p of due.installments) financeActions.payInstallment(p.id, p.qty);
    return due.amount;
  },
  /** Cartões com débito no vencimento: quita automaticamente faturas vencidas. */
  autoSettleDueInvoices() {
    for (const card of state.cards.filter((c) => c.debitMode === "on_due")) {
      const due = cardInvoiceDue(state, card.id);
      if (due.amount > 0 && due.overdue) financeActions.payCardInvoice(card.id);
    }
  },
  removeCard(id: string) {
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
    void cloudDelete("cards", id);
  },

  addGoal(goal: Omit<Goal, "id">) {
    const full: Goal = { ...goal, id: crypto.randomUUID() };
    setState((s) => ({ ...s, goals: [...s.goals, full] }));
    if (currentUserId) void cloudInsert("goals", goalToRow(full, currentUserId));
  },
  contributeGoal(id: string, amount: number) {
    let next: Goal | undefined;
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        next = { ...g, saved: g.saved + amount };
        return next;
      }),
    }));
    if (next) void cloudUpdate("goals", id, { saved: next.saved });
  },
  removeGoal(id: string) {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
    void cloudDelete("goals", id);
  },
  toggleHideBalance() {
    setState((s) => ({ ...s, hideBalance: !s.hideBalance }));
  },
  setUserName(name: string) {
    setState((s) => ({ ...s, userName: name }));
  },
  addInstallment(p: Omit<InstallmentPurchase, "id" | "paid"> & { paid?: number }) {
    const full: InstallmentPurchase = { ...p, paid: p.paid ?? 0, id: crypto.randomUUID() };
    setState((s) => ({ ...s, installmentPurchases: [full, ...s.installmentPurchases] }));
    if (currentUserId) void cloudInsert("installment_purchases", installmentToRow(full, currentUserId));
  },
  payInstallment(id: string, qty = 1) {
    let next: InstallmentPurchase | undefined;
    setState((s) => ({
      ...s,
      installmentPurchases: s.installmentPurchases.map((p) => {
        if (p.id !== id) return p;
        next = { ...p, paid: Math.min(p.installments, p.paid + qty) };
        return next;
      }),
    }));
    if (next) void cloudUpdate("installment_purchases", id, { paid: next.paid });
  },
  payOffInstallment(id: string) {
    let next: InstallmentPurchase | undefined;
    setState((s) => ({
      ...s,
      installmentPurchases: s.installmentPurchases.map((p) => {
        if (p.id !== id) return p;
        next = { ...p, paid: p.installments };
        return next;
      }),
    }));
    if (next) void cloudUpdate("installment_purchases", id, { paid: next.paid });
  },
  removeInstallment(id: string) {
    setState((s) => ({ ...s, installmentPurchases: s.installmentPurchases.filter((p) => p.id !== id) }));
    void cloudDelete("installment_purchases", id);
  },
  addAsset(a: Omit<Asset, "id">) {
    const full: Asset = { ...a, id: crypto.randomUUID() };
    setState((s) => ({ ...s, assets: [...s.assets, full] }));
    if (currentUserId) void cloudInsert("assets", assetToRow(full, currentUserId));
  },
  removeAsset(id: string) {
    setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== id) }));
    void cloudDelete("assets", id);
  },
  addDebt(d: Omit<Debt, "id">) {
    const full: Debt = { ...d, id: crypto.randomUUID() };
    setState((s) => ({ ...s, debts: [...s.debts, full] }));
    if (currentUserId) void cloudInsert("debts", debtToRow(full, currentUserId));
  },
  removeDebt(id: string) {
    setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) }));
    void cloudDelete("debts", id);
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

  // ===== Central de notificações =====
  setNotifMeta(id: string, patch: NotifMeta) {
    setState((s) => ({
      ...s,
      notifMeta: { ...s.notifMeta, [id]: { ...(s.notifMeta[id] ?? {}), ...patch } },
    }));
  },
  markNotifRead(id: string, read = true) {
    financeActions.setNotifMeta(id, { read });
  },
  toggleNotifStar(id: string) {
    setState((s) => {
      const current = s.notifMeta[id] ?? {};
      return {
        ...s,
        notifMeta: { ...s.notifMeta, [id]: { ...current, starred: !current.starred } },
      };
    });
  },
  archiveNotif(id: string, archived = true) {
    financeActions.setNotifMeta(id, { archived, read: true });
  },
  markAllNotifsRead(ids: string[]) {
    setState((s) => {
      const meta = { ...s.notifMeta };
      for (const id of ids) meta[id] = { ...(meta[id] ?? {}), read: true };
      return { ...s, notifMeta: meta };
    });
  },
  setNotifPrefs(patch: Partial<NotifPrefs>) {
    setState((s) => ({ ...s, notifPrefs: { ...s.notifPrefs, ...patch } }));
  },
  toggleNotifCategory(category: NotifCategory) {
    setState((s) => {
      const disabled = s.notifPrefs.disabled.includes(category)
        ? s.notifPrefs.disabled.filter((c) => c !== category)
        : [...s.notifPrefs.disabled, category];
      return { ...s, notifPrefs: { ...s.notifPrefs, disabled } };
    });
  },
  muteNotifsFor(hours: number) {
    setState((s) => ({
      ...s,
      notifPrefs: {
        ...s.notifPrefs,
        mutedUntil:
          hours <= 0 ? undefined : new Date(Date.now() + hours * 3_600_000).toISOString(),
      },
    }));
  },
};


// Derivations
export interface MonthlySummary {
  income: number;
  expense: number;
  savings: number;
  /** Saldo atual da conta (compras no cartão em aberto e lançamentos futuros não são descontados). */
  balance: number;
  /** Faturas em aberto + parcelas restantes + despesas futuras já lançadas. */
  committed: number;
  /** Saldo disponível = saldo atual - comprometido. */
  free: number;
  /** Saldo projetado = saldo atual + receitas futuras - comprometido. */
  projected: number;
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
  const balance = accountBalance(s);
  const committed = committedTotal(s);
  const catMap = new Map<string, number>();
  for (const t of month.filter((t) => t.kind === "despesa")) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, total]) => ({ category, total, color: colorForCategory(category) }))
    .sort((a, b) => b.total - a.total);
  return {
    income,
    expense,
    savings: income - expense,
    balance,
    committed,
    free: balance - committed,
    byCategory,
  };

}

export interface MonthPoint {
  key: string; // "2026-05"
  label: string; // "mai"
  income: number;
  expense: number;
  savings: number;
}

/** Evolução de receitas, despesas e saldo nos últimos `count` meses (mais antigo → atual). */
export function getMonthlyHistory(s: FinanceState, count = 6, ref = new Date()): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const month = s.transactions.filter((t) => {
      const td = new Date(t.date);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    const income = month.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
    const expense = month.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
    points.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      income,
      expense,
      savings: income - expense,
    });
  }
  return points;
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
    .filter((t) => t.cardId === cardId && t.kind === "despesa" && !t.invoicePaid)
    .reduce((a, t) => a + t.amount, 0);
  return future + txs;
}

// ===== Saldo da conta x valor comprometido no cartão =====

export function cardDebitMode(s: FinanceState, cardId?: string): DebitMode | null {
  if (!cardId) return null;
  return s.cards.find((c) => c.id === cardId)?.debitMode ?? null;
}

/** Uma despesa em cartão de crédito com débito diferido NUNCA sai direto da conta:
 *  o débito acontece pela transação "Pagamento da fatura". Evita dupla dedução. */
export function hitsAccountBalance(s: FinanceState, t: Transaction): boolean {
  if (t.kind !== "despesa") return false;
  const mode = cardDebitMode(s, t.cardId);
  return !mode || mode === "immediate";
}

/** Uma transação só entra no saldo atual depois da sua data de competência. */
function alreadyHappened(t: Transaction, ref: Date): boolean {
  return new Date(t.date).getTime() <= ref.getTime();
}

/** Saldo atual da conta: só movimentações já ocorridas, sem compras de cartão em aberto. */
export function accountBalance(s: FinanceState, ref = new Date()): number {
  const done = s.transactions.filter((t) => alreadyHappened(t, ref));
  const income = done.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
  const expense = done.filter((t) => hitsAccountBalance(s, t)).reduce((a, t) => a + t.amount, 0);
  return income - expense;
}

/** Tudo que já está comprometido e ainda vai sair da conta:
 *  faturas de cartão em aberto + parcelas restantes + despesas futuras já lançadas. */
export function committedTotal(s: FinanceState, ref = new Date()): number {
  const cardIds = s.cards.filter((c) => c.debitMode !== "immediate").map((c) => c.id);
  const cardTxs = s.transactions
    .filter((t) => t.kind === "despesa" && !t.invoicePaid && t.cardId && cardIds.includes(t.cardId))
    .reduce((a, t) => a + t.amount, 0);
  const inst = s.installmentPurchases
    .filter((p) => !p.cardId || cardIds.includes(p.cardId))
    .reduce((a, p) => a + installmentAmount(p) * (p.installments - p.paid), 0);
  // Despesas futuras (recorrentes/agendadas) que ainda não saíram da conta.
  const future = s.transactions
    .filter((t) => !alreadyHappened(t, ref) && hitsAccountBalance(s, t))
    .reduce((a, t) => a + t.amount, 0);
  return cardTxs + inst + future;
}

/** Receitas já lançadas com data futura (salário agendado, recorrências). */
export function futureIncomeTotal(s: FinanceState, ref = new Date()): number {
  return s.transactions
    .filter((t) => t.kind === "receita" && !alreadyHappened(t, ref))
    .reduce((a, t) => a + t.amount, 0);
}

/** Saldo disponível = saldo atual menos o que já está comprometido. */
export function freeBalance(s: FinanceState, ref = new Date()): number {
  return accountBalance(s, ref) - committedTotal(s, ref);
}

/** Saldo projetado = saldo atual + receitas futuras − comprometido. */
export function projectedBalance(s: FinanceState, ref = new Date()): number {
  return accountBalance(s, ref) + futureIncomeTotal(s, ref) - committedTotal(s, ref);
}


export interface InvoiceDue {
  amount: number;
  txIds: string[];
  installments: { id: string; qty: number }[];
  dueDate: Date;
  overdue: boolean;
}

/** Fatura em aberto de um cartão até o mês de referência (inclusive). */
export function cardInvoiceDue(s: FinanceState, cardId: string, ref = new Date()): InvoiceDue {
  const card = s.cards.find((c) => c.id === cardId);
  const limitTime = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59).getTime();
  const txs = s.transactions.filter(
    (t) =>
      t.cardId === cardId &&
      t.kind === "despesa" &&
      !t.invoicePaid &&
      new Date(t.date).getTime() <= limitTime,
  );
  const entries = getAllInstallmentEntries(s).filter(
    (e) => e.cardId === cardId && !e.paid && e.date.getTime() <= limitTime,
  );
  const perPurchase = new Map<string, number>();
  for (const e of entries) perPurchase.set(e.purchaseId, (perPurchase.get(e.purchaseId) ?? 0) + 1);
  const amount =
    txs.reduce((a, t) => a + t.amount, 0) + entries.reduce((a, e) => a + e.amount, 0);
  const dueDate = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    Math.min(card?.dueDay ?? 28, 28),
  );
  return {
    amount,
    txIds: txs.map((t) => t.id),
    installments: Array.from(perPurchase.entries()).map(([id, qty]) => ({ id, qty })),
    dueDate,
    overdue: amount > 0 && dueDate.getTime() < Date.now(),
  };
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
    {
      id: "tx-50",
      title: "Registrador dedicado",
      description: "Registre 50 movimentações no total.",
      emoji: "📒",
      unlocked: txCount >= 50,
      progress: Math.min(100, (txCount / 50) * 100),
    },
    {
      id: "saver-40",
      title: "Poupador de elite",
      description: "Economize 40% ou mais da renda no mês.",
      emoji: "💎",
      unlocked: savingsRate >= 40,
      progress: Math.min(100, (savingsRate / 40) * 100),
    },
    {
      id: "goals-3",
      title: "Triplo de metas",
      description: "Conclua 3 metas financeiras.",
      emoji: "🏅",
      unlocked: goalsDone >= 3,
      progress: Math.min(100, (goalsDone / 3) * 100),
    },
    {
      id: "patrimony-100k",
      title: "Seis dígitos",
      description: "Atinja R$ 100.000 de patrimônio líquido.",
      emoji: "👑",
      unlocked: nw.net >= 100000,
      progress: Math.min(100, (nw.net / 100000) * 100),
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
  const now = new Date();
  const monthTxCount = s.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;


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
    {
      id: "log-15",
      title: "Diário em dia",
      description: "Registre 15 movimentações neste mês.",
      emoji: "✍️",
      progress: Math.min(100, (monthTxCount / 15) * 100),
      target: "15",
      current: `${monthTxCount}`,
      done: monthTxCount >= 15,
    },
    {
      id: "positive-month",
      title: "Mês no azul",
      description: "Termine o mês com saldo positivo.",
      emoji: "📈",
      progress: summary.savings > 0 ? 100 : 0,
      target: "Saldo +",
      current: formatCompactBRLLocal(summary.savings),
      done: summary.savings > 0,
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