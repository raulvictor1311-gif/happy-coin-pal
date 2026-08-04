// ============================================================
// Lux IA — núcleo do mascote/assistente do Finlux
// Camada 100% de apresentação: emoções, poses, falas, níveis e
// vínculo emocional. Não altera nenhuma regra financeira existente.
// ============================================================

import {
  getLevel,
  getStreak,
  netWorth,
  type FinanceState,
} from "@/lib/finance-store";
import { financialScore } from "@/lib/finance-ai";

/** Estados emocionais do Lux. Cada um mapeia para uma pose/animação. */
export type LuxEmotion =
  | "recepcionando"
  | "feliz"
  | "muito_feliz"
  | "comemorando"
  | "orgulhoso"
  | "pensando"
  | "processando"
  | "analisando"
  | "professor"
  | "dica"
  | "economizando"
  | "investindo"
  | "planejando"
  | "seguranca"
  | "alerta"
  | "dormindo"
  | "motivando"
  | "recompensando";

/** Pose visual reutilizável: qual arte usar e com que energia animar. */
export type LuxPose = {
  /** Arte base do mascote. */
  art: "hello" | "thinking" | "celebrating";
  /** Intensidade da microanimação (0 = quase parado, 1 = elétrico). */
  energy: number;
  /** Cor de aura, em token semântico. */
  aura: "primary" | "success" | "warning";
  /** Descrição para leitores de tela. */
  alt: string;
};

export const LUX_POSES: Record<LuxEmotion, LuxPose> = {
  recepcionando: { art: "hello", energy: 0.6, aura: "primary", alt: "Lux acenando um olá" },
  feliz: { art: "hello", energy: 0.5, aura: "primary", alt: "Lux sorrindo" },
  muito_feliz: { art: "celebrating", energy: 0.8, aura: "success", alt: "Lux muito animado" },
  comemorando: { art: "celebrating", energy: 1, aura: "success", alt: "Lux comemorando com os braços erguidos" },
  orgulhoso: { art: "celebrating", energy: 0.7, aura: "success", alt: "Lux orgulhoso de você" },
  pensando: { art: "thinking", energy: 0.35, aura: "primary", alt: "Lux pensando" },
  processando: { art: "thinking", energy: 0.9, aura: "primary", alt: "Lux processando dados" },
  analisando: { art: "thinking", energy: 0.5, aura: "primary", alt: "Lux analisando seus números" },
  professor: { art: "thinking", energy: 0.4, aura: "primary", alt: "Lux explicando" },
  dica: { art: "hello", energy: 0.55, aura: "primary", alt: "Lux dando uma dica" },
  economizando: { art: "hello", energy: 0.45, aura: "success", alt: "Lux economizando" },
  investindo: { art: "thinking", energy: 0.5, aura: "success", alt: "Lux investindo" },
  planejando: { art: "thinking", energy: 0.45, aura: "primary", alt: "Lux planejando" },
  seguranca: { art: "hello", energy: 0.3, aura: "success", alt: "Lux protegendo seus dados" },
  alerta: { art: "thinking", energy: 0.6, aura: "warning", alt: "Lux com uma observação importante" },
  dormindo: { art: "thinking", energy: 0.15, aura: "primary", alt: "Lux descansando" },
  motivando: { art: "celebrating", energy: 0.75, aura: "primary", alt: "Lux te motivando" },
  recompensando: { art: "celebrating", energy: 0.85, aura: "success", alt: "Lux entregando uma recompensa" },
};

// ------------------------------------------------------------
// Evolução do Lux
// ------------------------------------------------------------

export type LuxRank = {
  key: "aprendiz" | "analista" | "especialista" | "mestre" | "lendario";
  name: string;
  /** Nível mínimo do app (getLevel) para alcançar este rank. */
  minLevel: number;
  /** O que este rank desbloqueia — usado em copy de gamificação. */
  unlocks: string;
};

export const LUX_RANKS: LuxRank[] = [
  { key: "aprendiz", name: "Lux Aprendiz", minLevel: 1, unlocks: "Falas de boas-vindas e dicas básicas" },
  { key: "analista", name: "Lux Analista", minLevel: 3, unlocks: "Análises de categorias e alertas amigáveis" },
  { key: "especialista", name: "Lux Especialista", minLevel: 5, unlocks: "Projeções e recomendações avançadas" },
  { key: "mestre", name: "Lux Mestre Financeiro", minLevel: 8, unlocks: "Celebrações exclusivas e plano de patrimônio" },
  { key: "lendario", name: "Lux Lendário", minLevel: 12, unlocks: "Aparência lendária e falas raras" },
];

export function luxRank(state: FinanceState): { rank: LuxRank; next: LuxRank | null; level: number; xp: number; nextXp: number } {
  const lvl = getLevel(state);
  let idx = 0;
  LUX_RANKS.forEach((r, i) => {
    if (lvl.level >= r.minLevel) idx = i;
  });
  return {
    rank: LUX_RANKS[idx],
    next: LUX_RANKS[idx + 1] ?? null,
    level: lvl.level,
    xp: lvl.xp,
    nextXp: lvl.nextXp,
  };
}

// ------------------------------------------------------------
// Vínculo emocional
// ------------------------------------------------------------

export type LuxBond = {
  /** Dias desde a primeira transação registrada. */
  daysTogether: number;
  /** Sequência diária de registros. */
  streak: number;
  /** Patrimônio líquido construído. */
  netWorth: number;
  /** Score financeiro atual (0-100). */
  score: number;
  /** Total de transações registradas juntos. */
  records: number;
};

export function luxBond(state: FinanceState, ref = new Date()): LuxBond {
  const dates = state.transactions
    .map((t) => new Date(`${t.date}T00:00:00`).getTime())
    .filter((n) => Number.isFinite(n));
  const first = dates.length > 0 ? Math.min(...dates) : ref.getTime();
  const days = Math.max(1, Math.round((ref.getTime() - first) / 86_400_000) + 1);
  return {
    daysTogether: days,
    streak: getStreak(state, ref),
    netWorth: netWorth(state).net,
    score: financialScore(state, ref).score,
    records: state.transactions.length,
  };
}

// ------------------------------------------------------------
// Falas do Lux
// ------------------------------------------------------------

export type LuxPhraseCategory =
  | "boas_vindas"
  | "receita"
  | "despesa"
  | "cartao"
  | "meta"
  | "investimento"
  | "patrimonio"
  | "educacao"
  | "seguranca"
  | "conquista"
  | "motivacao"
  | "alerta"
  | "processando";

const PHRASES: Record<LuxPhraseCategory, string[]> = {
  boas_vindas: [
    "Oi! Sou o Lux. Vamos cuidar do seu dinheiro juntos?",
    "Que bom te ver. Bora deixar suas finanças mais leves hoje?",
    "Cheguei! Me conta: o que você quer conquistar primeiro?",
    "Pronto pra evoluir? Eu cuido dos números, você aproveita a vida.",
  ],
  receita: [
    "Entrada registrada! Cada real que entra é uma escolha nova.",
    "Boa! Receita anotada. Já pensou em guardar uma parte?",
    "Mais um passo. Receitas organizadas facilitam tudo depois.",
  ],
  despesa: [
    "Anotado, sem julgamento. Registrar já é metade do controle.",
    "Registrei. Gastar consciente é diferente de gastar demais.",
    "Feito! Isso vira dado, e dado vira decisão melhor.",
  ],
  cartao: [
    "Compras no cartão viram compromisso futuro. Eu acompanho por você.",
    "Seu cartão está no meu radar. Te aviso antes de apertar.",
    "Parcelou? Tranquilo. Vou distribuir isso no seu planejamento.",
  ],
  meta: [
    "Metas são promessas para o seu futuro. Vamos honrar essa?",
    "Cada aporte aproxima o objetivo. Sigo torcendo por você.",
    "Falta pouco. Constância vale mais que valor alto.",
  ],
  investimento: [
    "Investir é pagar o seu futuro primeiro. Simples assim.",
    "Comece pequeno, mas comece. O tempo faz o resto.",
    "Rendimento é bom, hábito é melhor. Você tem os dois.",
  ],
  patrimonio: [
    "Seu patrimônio está tomando forma. Isso é liberdade sendo construída.",
    "Patrimônio cresce devagar e de repente. Continue.",
    "O que você constrói hoje sustenta suas escolhas amanhã.",
  ],
  educacao: [
    "Dica rápida: reserve o equivalente a 6 meses de gastos essenciais.",
    "Antes de comprar, pergunte: isso caberia de novo no mês que vem?",
    "Gastos pequenos e repetidos costumam pesar mais que os grandes.",
    "Orçamento não é prisão, é permissão consciente para gastar.",
  ],
  seguranca: [
    "Seus dados ficam protegidos. Só você acessa suas finanças.",
    "Nunca vou pedir senha de banco. Desconfie de quem pedir.",
  ],
  conquista: [
    "Isso merece comemoração! Orgulho de você.",
    "Conquista desbloqueada. Você está criando um hábito forte.",
    "Uau! Esse é o tipo de progresso que muda o ano.",
  ],
  motivacao: [
    "Um dia organizado por vez. Estou aqui do seu lado.",
    "Você já foi mais longe do que imagina. Vamos continuar.",
    "Nada de perfeição. Só constância. Isso você tem.",
  ],
  alerta: [
    "Percebi algo que vale sua atenção — nada grave, só um cuidado.",
    "Só um aviso amigável: esse ritmo pode apertar o fim do mês.",
    "Vamos ajustar juntos antes que vire problema, tudo bem?",
  ],
  processando: [
    "Analisando seus números...",
    "Cruzando seus dados financeiros...",
    "Pensando na melhor recomendação...",
  ],
};

/**
 * Escolhe uma fala do Lux. Com `seed`, a escolha é estável (útil para
 * evitar troca de texto em cada render); sem seed, é aleatória.
 */
export function luxPhrase(category: LuxPhraseCategory, seed?: number | string): string {
  const list = PHRASES[category];
  if (seed === undefined) return list[Math.floor(Math.random() * list.length)];
  const n =
    typeof seed === "number"
      ? Math.abs(Math.trunc(seed))
      : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[n % list.length];
}

/** Saudação contextual, considerando hora do dia e situação financeira. */
export function luxGreeting(
  state: FinanceState,
  name?: string | null,
  ref = new Date(),
): { emotion: LuxEmotion; text: string } {
  const hour = ref.getHours();
  const first = (name ?? "").trim().split(" ")[0];
  const who = first ? `${first}, ` : "";
  const bond = luxBond(state, ref);

  if (state.transactions.length === 0) {
    return { emotion: "recepcionando", text: `${who}vamos começar? Registre sua primeira transação e eu cuido da análise.` };
  }
  if (hour >= 0 && hour < 5) {
    return { emotion: "dormindo", text: `${who}acordado essa hora? Deixa que eu vigio suas finanças.` };
  }
  if (bond.streak >= 7) {
    return { emotion: "orgulhoso", text: `${who}${bond.streak} dias seguidos registrando. Isso é disciplina de verdade!` };
  }
  if (bond.score >= 75) {
    return { emotion: "muito_feliz", text: `${who}suas finanças estão em ótima forma. Score ${bond.score}/100.` };
  }
  if (bond.score < 35) {
    return { emotion: "alerta", text: `${who}dá pra melhorar o mês. Me deixa te mostrar por onde começar?` };
  }
  const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return { emotion: "feliz", text: `${saudacao}${first ? `, ${first}` : ""}! Estamos juntos há ${bond.daysTogether} dias.` };
}
