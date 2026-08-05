// ============================================================
// Central de Notificações Inteligentes — voz do Lux IA
// Camada 100% derivada: gera notificações a partir do estado
// financeiro real do usuário. Nenhum dado fictício.
// ============================================================

import {
  cardInvoiceDue,
  freeBalance,
  getAchievements,
  getAllInstallmentEntries,
  getMonthlyHistory,
  getMonthlySummary,
  getStreak,
  netWorth,
  type FinanceState,
} from "@/lib/finance-store";
import { detectRecurring, financialScore } from "@/lib/finance-ai";
import type { LuxEmotion } from "@/lib/lux";

export type NotifCategory =
  | "receitas"
  | "despesas"
  | "cartoes"
  | "recorrentes"
  | "metas"
  | "investimentos"
  | "conquistas"
  | "sequencia"
  | "lux"
  | "lembretes"
  | "alertas"
  | "resumos";

export type NotifPriority = "alta" | "media" | "baixa";

export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; emoji: string }[] = [
  { key: "receitas", label: "Receitas", emoji: "💰" },
  { key: "despesas", label: "Despesas", emoji: "💸" },
  { key: "cartoes", label: "Cartões", emoji: "💳" },
  { key: "recorrentes", label: "Contas recorrentes", emoji: "📅" },
  { key: "metas", label: "Metas", emoji: "🎯" },
  { key: "investimentos", label: "Investimentos", emoji: "📈" },
  { key: "conquistas", label: "Conquistas", emoji: "🏆" },
  { key: "sequencia", label: "Sequência diária", emoji: "🔥" },
  { key: "lux", label: "Lux IA", emoji: "🤖" },
  { key: "lembretes", label: "Lembretes", emoji: "🔔" },
  { key: "alertas", label: "Alertas", emoji: "🚨" },
  { key: "resumos", label: "Resumos", emoji: "🗓️" },
];

export const CATEGORY_LABEL: Record<NotifCategory, string> = NOTIF_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<NotifCategory, string>,
);

export interface LuxNotification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  emoji: string;
  priority: NotifPriority;
  tone: "info" | "warn" | "success";
  /** Data de referência da notificação (ISO). */
  date: string;
  /** Rota do app aberta ao tocar na notificação. */
  href: string;
  /** Emoção do Lux ao comunicar isso. */
  emotion: LuxEmotion;
}

export interface NotifMeta {
  read?: boolean;
  starred?: boolean;
  archived?: boolean;
}

export interface NotifPrefs {
  /** Categorias ativas. Ausente = ativa. */
  disabled: NotifCategory[];
  /** Só notificações de prioridade alta. */
  onlyImportant: boolean;
  /** Janela de silêncio (hora local, 0-23). */
  quietStart: number;
  quietEnd: number;
  /** Dias da semana permitidos (0 = domingo). */
  days: number[];
  sound: boolean;
  vibration: boolean;
  /** Resumos automáticos. */
  digest: "diario" | "semanal" | "mensal" | "off";
  /** Silenciar até (ISO). */
  mutedUntil?: string;
  /** Limite de notificações mostradas por vez (anti-excesso). */
  maxPerDay: number;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  disabled: [],
  onlyImportant: false,
  quietStart: 22,
  quietEnd: 7,
  days: [0, 1, 2, 3, 4, 5, 6],
  sound: true,
  vibration: true,
  digest: "diario",
  maxPerDay: 8,
};

const PRIORITY_WEIGHT: Record<NotifPriority, number> = { alta: 0, media: 1, baixa: 2 };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const iso = (d: Date) => d.toISOString();
const daysBetween = (a: Date, b: Date) =>
  Math.round((a.setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0)) / 86_400_000);

/**
 * Gera todas as notificações possíveis a partir dos dados reais.
 * Função pura: mesma entrada, mesma saída (ids estáveis).
 */
export function generateNotifications(state: FinanceState, ref = new Date()): LuxNotification[] {
  const out: LuxNotification[] = [];
  const push = (n: LuxNotification) => out.push(n);
  const monthKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const dayKey = `${monthKey}-${String(ref.getDate()).padStart(2, "0")}`;
  const summary = getMonthlySummary(state, ref);

  // ---------- Cartões: fechamento, vencimento e limite ----------
  for (const card of state.cards) {
    const due = cardInvoiceDue(state, card.id, ref);
    const daysToDue = daysBetween(new Date(due.dueDate), ref) * -1;
    if (due.amount > 0 && due.overdue) {
      push({
        id: `card-overdue-${card.id}-${monthKey}`,
        category: "cartoes",
        title: `Fatura vencida — ${card.name}`,
        body: `${brl(due.amount)} em aberto. Posso te ajudar a organizar esse pagamento.`,
        emoji: "🚨",
        priority: "alta",
        tone: "warn",
        date: iso(ref),
        href: "/cartoes",
        emotion: "alerta",
      });
    } else if (due.amount > 0 && daysToDue >= 0 && daysToDue <= 5) {
      push({
        id: `card-due-${card.id}-${monthKey}`,
        category: "cartoes",
        title: `Fatura de ${card.name} vence em ${daysToDue === 0 ? "hoje" : `${daysToDue} dia${daysToDue > 1 ? "s" : ""}`}`,
        body: `Valor atual: ${brl(due.amount)}.`,
        emoji: "💳",
        priority: "alta",
        tone: "info",
        date: iso(ref),
        href: "/cartoes",
        emotion: "planejando",
      });
    }
    const daysToClose = card.closingDay - ref.getDate();
    if (daysToClose >= 0 && daysToClose <= 3 && due.amount > 0) {
      push({
        id: `card-closing-${card.id}-${monthKey}`,
        category: "cartoes",
        title: `Fatura de ${card.name} fecha em breve`,
        body:
          daysToClose === 0
            ? "A fatura fecha hoje. Compras de agora entram na próxima."
            : `Fecha em ${daysToClose} dia${daysToClose > 1 ? "s" : ""}.`,
        emoji: "📆",
        priority: "media",
        tone: "info",
        date: iso(ref),
        href: "/cartoes",
        emotion: "dica",
      });
    }
    if (card.limit > 0 && due.amount / card.limit >= 0.8) {
      push({
        id: `card-limit-${card.id}-${monthKey}`,
        category: "alertas",
        title: `Limite de ${card.name} em ${Math.round((due.amount / card.limit) * 100)}%`,
        body: "Nada grave — só vale segurar novas compras nesse cartão por agora.",
        emoji: "⚠️",
        priority: "alta",
        tone: "warn",
        date: iso(ref),
        href: "/cartoes",
        emotion: "alerta",
      });
    }
  }

  // ---------- Parcelas do mês ----------
  const upcoming = getAllInstallmentEntries(state).filter((e) => {
    if (e.paid) return false;
    const diff = daysBetween(new Date(e.date), ref) * -1;
    return diff >= 0 && diff <= 7;
  });
  if (upcoming.length > 0) {
    const total = upcoming.reduce((a, e) => a + e.amount, 0);
    push({
      id: `installments-week-${dayKey}`,
      category: "lembretes",
      title:
        upcoming.length === 1
          ? `Parcela de ${upcoming[0].name} chegando`
          : `${upcoming.length} parcelas nos próximos dias`,
      body: `Total de ${brl(total)} comprometido nesta semana.`,
      emoji: "🔔",
      priority: "media",
      tone: "info",
      date: iso(ref),
      href: "/parcelas",
      emotion: "planejando",
    });
  }

  // ---------- Contas recorrentes / assinaturas ----------
  for (const item of detectRecurring(state, ref)) {
    const diff = item.nextDay - ref.getDate();
    if (diff >= 0 && diff <= 3) {
      push({
        id: `recurring-${item.description.toLowerCase().replace(/\s+/g, "-")}-${monthKey}`,
        category: "recorrentes",
        title: `${item.description} vence em breve`,
        body: `Costuma ser ${brl(item.amount)} por mês${diff === 0 ? " — é hoje." : ` — em ${diff} dia${diff > 1 ? "s" : ""}.`}`,
        emoji: "📅",
        priority: "media",
        tone: "info",
        date: iso(ref),
        href: "/extrato",
        emotion: "planejando",
      });
    }
  }

  // ---------- Metas ----------
  for (const g of state.goals) {
    if (g.target <= 0) continue;
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    if (pct >= 100) {
      push({
        id: `goal-done-${g.id}`,
        category: "metas",
        title: "Meta conquistada! 🎉",
        body: `Você completou "${g.title}". Isso merece comemoração.`,
        emoji: g.emoji || "🎯",
        priority: "media",
        tone: "success",
        date: iso(ref),
        href: "/metas",
        emotion: "comemorando",
      });
      continue;
    }
    if (pct >= 70) {
      push({
        id: `goal-70-${g.id}-${monthKey}`,
        category: "metas",
        title: `Você já atingiu ${pct}% da meta "${g.title}"`,
        body: `Faltam ${brl(Math.max(0, g.target - g.saved))} para chegar lá.`,
        emoji: "🎯",
        priority: "baixa",
        tone: "success",
        date: iso(ref),
        href: "/metas",
        emotion: "motivando",
      });
    }
    if (g.deadline) {
      const left = daysBetween(new Date(g.deadline), ref) * -1;
      if (left >= 0 && left <= 15) {
        push({
          id: `goal-deadline-${g.id}`,
          category: "metas",
          title: `Prazo da meta "${g.title}" está perto`,
          body: `Faltam ${left === 0 ? "poucas horas" : `${left} dia${left > 1 ? "s" : ""}`} e ${brl(Math.max(0, g.target - g.saved))}.`,
          emoji: "⏳",
          priority: "media",
          tone: "info",
          date: iso(ref),
          href: "/metas",
          emotion: "planejando",
        });
      }
    }
  }

  // ---------- Saldo livre / alertas de fluxo ----------
  const free = freeBalance(state);
  if (summary.income > 0 && free < 0) {
    push({
      id: `free-negative-${monthKey}`,
      category: "alertas",
      title: "Seu saldo livre está negativo",
      body: `Depois do que já está comprometido, sobra ${brl(free)}. Vamos ajustar juntos?`,
      emoji: "🚨",
      priority: "alta",
      tone: "warn",
      date: iso(ref),
      href: "/",
      emotion: "alerta",
    });
  }
  if (summary.income > 0 && summary.savings < 0) {
    push({
      id: `overspend-${monthKey}`,
      category: "despesas",
      title: "Gastos passaram das receitas neste mês",
      body: `Diferença de ${brl(Math.abs(summary.savings))}. Dá pra recuperar com pequenos ajustes.`,
      emoji: "📉",
      priority: "alta",
      tone: "warn",
      date: iso(ref),
      href: "/relatorio",
      emotion: "alerta",
    });
  }

  // ---------- Insights comparativos (mês atual x anterior) ----------
  const history = getMonthlyHistory(state, 2, ref);
  const prev = history[0];
  const curr = history[1];
  if (prev && curr && prev.expense > 0) {
    const diff = prev.savings > 0 || curr.savings > 0 ? curr.savings - prev.savings : 0;
    if (diff > 0) {
      push({
        id: `saved-more-${monthKey}`,
        category: "lux",
        title: `Você guardou ${brl(diff)} mais que no mês passado`,
        body: "Constância é o que constrói patrimônio. Muito bem!",
        emoji: "🎉",
        priority: "baixa",
        tone: "success",
        date: iso(ref),
        href: "/relatorio",
        emotion: "orgulhoso",
      });
    }
    const drop = ((prev.expense - curr.expense) / prev.expense) * 100;
    if (drop >= 10) {
      push({
        id: `expense-drop-${monthKey}`,
        category: "lux",
        title: `Suas despesas caíram ${Math.round(drop)}%`,
        body: `De ${brl(prev.expense)} para ${brl(curr.expense)} no comparativo mensal.`,
        emoji: "📉",
        priority: "baixa",
        tone: "success",
        date: iso(ref),
        href: "/relatorio",
        emotion: "muito_feliz",
      });
    } else if (drop <= -25) {
      push({
        id: `expense-rise-${monthKey}`,
        category: "lux",
        title: `Suas despesas subiram ${Math.abs(Math.round(drop))}%`,
        body: `Comparando com ${brl(prev.expense)} do mês passado. Vale olhar as categorias.`,
        emoji: "📊",
        priority: "media",
        tone: "info",
        date: iso(ref),
        href: "/relatorio",
        emotion: "analisando",
      });
    }
  }

  // ---------- Patrimônio e investimentos ----------
  const nw = netWorth(state);
  if (nw.net > 0) {
    push({
      id: `networth-${monthKey}`,
      category: "investimentos",
      title: `Seu patrimônio está em ${brl(nw.net)}`,
      body: "Liberdade sendo construída, um mês por vez.",
      emoji: "📈",
      priority: "baixa",
      tone: "success",
      date: iso(ref),
      href: "/patrimonio",
      emotion: "investindo",
    });
  }

  // ---------- Sequência e motivação ----------
  const streak = getStreak(state, ref);
  if (streak >= 3) {
    push({
      id: `streak-${streak}-${dayKey}`,
      category: "sequencia",
      title: `${streak} dias seguidos registrando`,
      body: "Esse hábito é o que separa quem controla de quem se perde nas contas.",
      emoji: "🔥",
      priority: "baixa",
      tone: "success",
      date: iso(ref),
      href: "/conquistas",
      emotion: "orgulhoso",
    });
  } else if (state.transactions.length > 0 && streak === 0) {
    push({
      id: `streak-lost-${dayKey}`,
      category: "sequencia",
      title: "Bora retomar o registro de hoje?",
      body: "Um lançamento rápido já mantém sua análise em dia.",
      emoji: "✍️",
      priority: "baixa",
      tone: "info",
      date: iso(ref),
      href: "/nova",
      emotion: "motivando",
    });
  }

  // ---------- Conquistas ----------
  for (const a of getAchievements(state).filter((x) => x.unlocked)) {
    push({
      id: `achievement-${a.id}`,
      category: "conquistas",
      title: `Conquista: ${a.title}`,
      body: a.description,
      emoji: a.emoji,
      priority: "baixa",
      tone: "success",
      date: iso(ref),
      href: "/conquistas",
      emotion: "recompensando",
    });
  }

  // ---------- Aniversários de uso ----------
  const dates = state.transactions
    .map((t) => new Date(t.date).getTime())
    .filter((n) => Number.isFinite(n));
  if (dates.length > 0) {
    const together = Math.max(1, daysBetween(new Date(ref), new Date(Math.min(...dates))) + 1);
    if (together % 100 === 0 || together === 30 || together === 365) {
      push({
        id: `anniversary-${together}`,
        category: "lux",
        title: `🏆 ${together} dias organizando suas finanças juntos`,
        body: "Obrigado pela confiança. Seguimos construindo.",
        emoji: "🏆",
        priority: "media",
        tone: "success",
        date: iso(ref),
        href: "/assistente",
        emotion: "comemorando",
      });
    }
  }

  // ---------- Resumos automáticos ----------
  const digest = state.notifPrefs?.digest ?? DEFAULT_NOTIF_PREFS.digest;
  if (digest !== "off" && state.transactions.length > 0) {
    if (digest === "diario") {
      const today = state.transactions.filter(
        (t) => new Date(t.date).toDateString() === ref.toDateString(),
      );
      const income = today.filter((t) => t.kind === "receita").reduce((a, t) => a + t.amount, 0);
      const expense = today.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
      push({
        id: `digest-day-${dayKey}`,
        category: "resumos",
        title: "Resumo do dia",
        body: `Entradas ${brl(income)} • Saídas ${brl(expense)} • Saldo livre ${brl(free)}.`,
        emoji: "🗓️",
        priority: "baixa",
        tone: "info",
        date: iso(ref),
        href: "/extrato",
        emotion: "analisando",
      });
    }
    if (digest === "semanal") {
      const weekAgo = ref.getTime() - 7 * 86_400_000;
      const week = state.transactions.filter((t) => new Date(t.date).getTime() >= weekAgo);
      const expense = week.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.amount, 0);
      push({
        id: `digest-week-${dayKey}`,
        category: "resumos",
        title: "Resumo da semana",
        body: `${week.length} lançamentos • ${brl(expense)} em despesas • Saldo livre ${brl(free)}.`,
        emoji: "🗓️",
        priority: "baixa",
        tone: "info",
        date: iso(ref),
        href: "/relatorio",
        emotion: "analisando",
      });
    }
    if (digest === "mensal") {
      const score = financialScore(state, ref).score;
      push({
        id: `digest-month-${monthKey}`,
        category: "resumos",
        title: "Resumo do mês",
        body: `Receitas ${brl(summary.income)} • Despesas ${brl(summary.expense)} • Economia ${brl(summary.savings)} • Saúde ${score}/100.`,
        emoji: "🗓️",
        priority: "baixa",
        tone: "info",
        date: iso(ref),
        href: "/relatorio",
        emotion: "professor",
      });
    }
  }

  return dedupe(out);
}

/** Remove notificações repetidas (mesmo id) e agrupa por prioridade. */
function dedupe(list: LuxNotification[]): LuxNotification[] {
  const seen = new Map<string, LuxNotification>();
  for (const n of list) if (!seen.has(n.id)) seen.set(n.id, n);
  return Array.from(seen.values()).sort(
    (a, b) =>
      PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}

export function isMuted(prefs: NotifPrefs, ref = new Date()): boolean {
  if (prefs.mutedUntil && new Date(prefs.mutedUntil).getTime() > ref.getTime()) return true;
  return false;
}

export function inQuietHours(prefs: NotifPrefs, ref = new Date()): boolean {
  const h = ref.getHours();
  const { quietStart: s, quietEnd: e } = prefs;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/**
 * Aplica preferências do usuário: categorias, prioridade, dias da semana,
 * janela de silêncio e limite anti-excesso. Alertas de prioridade alta
 * nunca são escondidos por silêncio — apenas desmarcados como "push".
 */
export function applyPrefs(
  list: LuxNotification[],
  prefs: NotifPrefs,
  ref = new Date(),
): LuxNotification[] {
  const dayAllowed = prefs.days.includes(ref.getDay());
  let filtered = list.filter((n) => !prefs.disabled.includes(n.category));
  if (prefs.onlyImportant) filtered = filtered.filter((n) => n.priority === "alta");
  if (!dayAllowed || isMuted(prefs, ref) || inQuietHours(prefs, ref)) {
    filtered = filtered.filter((n) => n.priority === "alta");
  }
  const max = Math.max(1, prefs.maxPerDay);
  return filtered.slice(0, Math.max(max, filtered.filter((n) => n.priority === "alta").length));
}

export type NotifView = "todas" | "nao-lidas" | "favoritas" | "arquivadas";

export interface NotifQuery {
  view: NotifView;
  category: NotifCategory | "all";
  search: string;
}

/** Filtra a lista já materializada com metadados (lida/favorita/arquivada). */
export function filterNotifications(
  list: LuxNotification[],
  meta: Record<string, NotifMeta>,
  deleted: string[],
  query: NotifQuery,
): LuxNotification[] {
  const term = query.search.trim().toLowerCase();
  return list.filter((n) => {
    if (deleted.includes(n.id)) return false;
    const m = meta[n.id] ?? {};
    if (query.view === "arquivadas" ? !m.archived : m.archived) return false;
    if (query.view === "nao-lidas" && m.read) return false;
    if (query.view === "favoritas" && !m.starred) return false;
    if (query.category !== "all" && n.category !== query.category) return false;
    if (term && !`${n.title} ${n.body}`.toLowerCase().includes(term)) return false;
    return true;
  });
}

export function unreadCount(
  list: LuxNotification[],
  meta: Record<string, NotifMeta>,
  deleted: string[],
): number {
  return list.filter((n) => {
    const m = meta[n.id] ?? {};
    return !deleted.includes(n.id) && !m.read && !m.archived;
  }).length;
}
