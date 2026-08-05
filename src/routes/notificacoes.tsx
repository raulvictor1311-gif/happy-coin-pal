import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BellOff,
  Check,
  CheckCheck,
  Search,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useFinance, financeActions } from "@/lib/finance-store";
import {
  NOTIF_CATEGORIES,
  applyPrefs,
  filterNotifications,
  generateNotifications,
  inQuietHours,
  isMuted,
  unreadCount,
  type NotifCategory,
  type NotifView,
} from "@/lib/notifications";
import { LuxBubble } from "@/components/lux/lux-bubble";
import { toast } from "sonner";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Finlux Finance" },
      {
        name: "description",
        content:
          "Central de notificações do Lux IA: lembretes de faturas, contas, metas e insights financeiros personalizados.",
      },
      { property: "og:title", content: "Central de Notificações do Lux IA" },
      {
        property: "og:description",
        content: "Lembretes, alertas e insights financeiros no momento certo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const VIEWS: { key: NotifView; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "nao-lidas", label: "Não lidas" },
  { key: "favoritas", label: "Favoritas" },
  { key: "arquivadas", label: "Arquivadas" },
];

function NotificationsPage() {
  const state = useFinance();
  const navigate = useNavigate();
  const [now, setNow] = useState<Date | null>(null);
  const [view, setView] = useState<NotifView>("todas");
  const [category, setCategory] = useState<NotifCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => setNow(new Date()), []);

  const prefs = state.notifPrefs;
  const all = useMemo(() => (now ? generateNotifications(state, now) : []), [state, now]);
  const visible = useMemo(
    () => (now ? applyPrefs(all, prefs, now) : []),
    [all, prefs, now],
  );
  const list = useMemo(
    () =>
      filterNotifications(visible, state.notifMeta, state.dismissedNotifs, {
        view,
        category,
        search,
      }),
    [visible, state.notifMeta, state.dismissedNotifs, view, category, search],
  );
  const unread = now ? unreadCount(visible, state.notifMeta, state.dismissedNotifs) : 0;
  const muted = now ? isMuted(prefs, now) : false;
  const quiet = now ? inQuietHours(prefs, now) : false;

  const luxLine =
    unread > 0
      ? `Você tem ${unread} ${unread === 1 ? "novidade" : "novidades"} pra ver. Separei só o que importa.`
      : all.length === 0
        ? "Sem novidades por aqui. Assim que eu notar algo nos seus números, te aviso."
        : "Tudo lido! Continuo de olho nas suas faturas, contas e metas.";

  return (
    <AppShell>
      <header className="px-6 pt-10 pb-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            aria-label="Voltar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-1.5">
            {list.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  financeActions.markAllNotifsRead(list.map((n) => n.id));
                  toast.success("Todas marcadas como lidas");
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground active:scale-95 transition-transform"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar lidas
              </button>
            )}
            <button
              type="button"
              aria-label="Preferências de notificação"
              onClick={() => setShowPrefs((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground active:scale-95 transition-transform"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Central do Lux
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">
          Notificações
          {unread > 0 && (
            <span className="ml-2 align-middle rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </h1>
      </header>

      <div className="px-6">
        <LuxBubble emotion={unread > 0 ? "dica" : "feliz"} size={52}>
          {luxLine}
        </LuxBubble>
      </div>

      {(muted || quiet) && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card-elevated px-4 py-3 text-xs text-muted-foreground">
          <BellOff className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />
          {muted
            ? "Notificações silenciadas. Só alertas importantes aparecem."
            : "Modo silencioso ativo neste horário. Só alertas importantes aparecem."}
        </div>
      )}

      {showPrefs && <PrefsPanel onClose={() => setShowPrefs(false)} />}

      {/* Busca */}
      <div className="px-6 mt-5">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notificações"
            aria-label="Buscar notificações"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Views */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
              view === v.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Categorias */}
      <div className="mt-2 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            category === "all"
              ? "bg-card-elevated text-primary border border-primary/40"
              : "border border-border bg-card text-muted-foreground"
          }`}
        >
          Todas as categorias
        </button>
        {NOTIF_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              category === c.key
                ? "bg-card-elevated text-primary border border-primary/40"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <section className="px-6 mt-4 space-y-2.5">
        {now === null &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-card-elevated" />
          ))}

        {now !== null && list.length === 0 && (
          <div className="rounded-3xl border border-border bg-card px-5 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">Nada por aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || category !== "all" || view !== "todas"
                ? "Nenhuma notificação com esses filtros."
                : "Registre suas movimentações e eu começo a te avisar do que importa."}
            </p>
          </div>
        )}

        {list.map((n) => {
          const meta = state.notifMeta[n.id] ?? {};
          const toneColor =
            n.tone === "warn"
              ? "var(--color-warning)"
              : n.tone === "success"
                ? "var(--color-success)"
                : "var(--color-primary)";
          return (
            <article
              key={n.id}
              className={`card-premium rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-1 duration-300 ${
                meta.read ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `color-mix(in oklab, ${toneColor} 16%, transparent)` }}
                >
                  {n.emoji}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    financeActions.markNotifRead(n.id);
                    void navigate({ to: n.href });
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    {!meta.read && (
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary glow-primary"
                      />
                    )}
                    <p className="text-sm font-bold text-foreground leading-snug">{n.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{n.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-card-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {NOTIF_CATEGORIES.find((c) => c.key === n.category)?.label}
                    </span>
                    {n.priority === "alta" && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)]">
                        Importante
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <IconBtn
                    label={meta.starred ? "Remover dos favoritos" : "Favoritar"}
                    onClick={() => financeActions.toggleNotifStar(n.id)}
                    active={!!meta.starred}
                  >
                    <Star className="h-4 w-4" fill={meta.starred ? "currentColor" : "none"} />
                  </IconBtn>
                  <IconBtn
                    label={meta.read ? "Marcar como não lida" : "Marcar como lida"}
                    onClick={() => financeActions.markNotifRead(n.id, !meta.read)}
                  >
                    <Check className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label={meta.archived ? "Desarquivar" : "Arquivar"}
                    onClick={() => financeActions.archiveNotif(n.id, !meta.archived)}
                  >
                    {meta.archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </IconBtn>
                  <IconBtn
                    label="Excluir"
                    onClick={() => {
                      financeActions.dismissNotification(n.id);
                      toast.success("Notificação excluída");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            </article>
          );
        })}

        {state.dismissedNotifs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              financeActions.clearDismissedNotifications();
              toast.success("Notificações excluídas restauradas");
            }}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-xs font-semibold text-muted-foreground"
          >
            Restaurar {state.dismissedNotifs.length} notificação(ões) excluída(s)
          </button>
        )}
      </section>
    </AppShell>
  );
}

function IconBtn({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-transform active:scale-90 ${
        active ? "text-[var(--color-warning)] bg-card-elevated" : "text-muted-foreground bg-card"
      }`}
    >
      {children}
    </button>
  );
}

function PrefsPanel({ onClose }: { onClose: () => void }) {
  const state = useFinance();
  const prefs = state.notifPrefs;
  const muted = prefs.mutedUntil && new Date(prefs.mutedUntil).getTime() > Date.now();

  return (
    <section className="mx-6 mt-4 rounded-3xl border border-border bg-card p-5 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Preferências</h2>
        <button type="button" onClick={onClose} aria-label="Fechar preferências">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <Toggle
        label="Só notificações importantes"
        hint="Recebe apenas alertas de prioridade alta."
        checked={prefs.onlyImportant}
        onChange={() => financeActions.setNotifPrefs({ onlyImportant: !prefs.onlyImportant })}
      />
      <Toggle
        label="Som"
        checked={prefs.sound}
        onChange={() => financeActions.setNotifPrefs({ sound: !prefs.sound })}
      />
      <Toggle
        label="Vibração"
        checked={prefs.vibration}
        onChange={() => financeActions.setNotifPrefs({ vibration: !prefs.vibration })}
      />

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Resumo automático
        </p>
        <div className="mt-2 flex gap-2">
          {(["diario", "semanal", "mensal", "off"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => financeActions.setNotifPrefs({ digest: d })}
              className={`flex-1 rounded-xl px-2 py-2 text-[11px] font-bold capitalize transition-colors ${
                prefs.digest === d
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card-elevated text-muted-foreground"
              }`}
            >
              {d === "off" ? "Nenhum" : d}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <NumberField
          label="Silêncio a partir de"
          value={prefs.quietStart}
          onChange={(v) => financeActions.setNotifPrefs({ quietStart: v })}
        />
        <NumberField
          label="Silêncio até"
          value={prefs.quietEnd}
          onChange={(v) => financeActions.setNotifPrefs({ quietEnd: v })}
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Dias da semana
        </p>
        <div className="mt-2 flex gap-1.5">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => {
            const on = prefs.days.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={`Dia ${i}`}
                aria-pressed={on}
                onClick={() =>
                  financeActions.setNotifPrefs({
                    days: on ? prefs.days.filter((x) => x !== i) : [...prefs.days, i],
                  })
                }
                className={`h-8 flex-1 rounded-lg text-[11px] font-bold transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card-elevated text-muted-foreground"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Categorias
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {NOTIF_CATEGORIES.map((c) => {
            const on = !prefs.disabled.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => financeActions.toggleNotifCategory(c.key)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  on
                    ? "bg-card-elevated text-foreground border border-primary/30"
                    : "border border-border bg-card text-muted-foreground opacity-60"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          financeActions.muteNotifsFor(muted ? 0 : 8);
          toast.success(muted ? "Notificações reativadas" : "Silenciado por 8 horas");
        }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card-elevated px-4 py-3 text-sm font-bold text-foreground active:scale-[0.98] transition-transform"
      >
        <BellOff className="h-4 w-4" />
        {muted ? "Reativar notificações" : "Silenciar por 8 horas"}
      </button>
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="mt-4 flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-card-elevated border border-border"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-border bg-card-elevated px-3 py-2 text-sm text-foreground outline-none"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}
