import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  useFinance,
  financeActions,
  netWorth,
  ASSET_LABELS,
  futureInstallmentsTotal,
  type AssetType,
} from "@/lib/finance-store";
import { formatBRL } from "@/lib/format";
import { Plus, Trash2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/patrimonio")({
  head: () => ({ meta: [{ title: "Patrimônio — Finlux" }] }),
  component: Patrimonio,
});

const TYPES: AssetType[] = ["conta", "investimento", "veiculo", "imovel", "outro"];

function Patrimonio() {
  const state = useFinance();
  const nw = netWorth(state);
  const [open, setOpen] = useState<null | "asset" | "debt">(null);

  const groups = TYPES.map((t) => ({
    type: t,
    label: ASSET_LABELS[t],
    items: state.assets.filter((a) => a.type === t),
    total: state.assets.filter((a) => a.type === t).reduce((a, x) => a + x.value, 0),
  }));

  return (
    <AppShell>
      <PageHeader subtitle="Você é dono de" title="Patrimônio" />
      <div className="px-6 space-y-4">
        <div className="rounded-3xl bg-card p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Patrimônio líquido</p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums"
            style={{ color: nw.net >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}
          >
            {formatBRL(nw.net)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-card-elevated p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Bens</p>
              <p className="font-bold tabular-nums">{formatBRL(nw.assets)}</p>
            </div>
            <div className="rounded-2xl bg-card-elevated p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Dívidas</p>
              <p className="font-bold tabular-nums">{formatBRL(nw.debts)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                inclui {formatBRL(futureInstallmentsTotal(state))} em parcelas
              </p>
            </div>
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.type}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {g.label}
              </h2>
              <span className="text-xs font-bold tabular-nums text-foreground">{formatBRL(g.total)}</span>
            </div>
            <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
              {g.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nada cadastrado.</p>
              )}
              {g.items.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground">{a.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums">{formatBRL(a.value)}</span>
                    <button onClick={() => financeActions.removeAsset(a.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Dívidas</h2>
            <span className="text-xs font-bold tabular-nums">{formatBRL(state.debts.reduce((a, d) => a + d.value, 0))}</span>
          </div>
          <div className="rounded-3xl bg-card border border-border divide-y divide-border overflow-hidden">
            {state.debts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dívidas cadastradas.</p>
            )}
            {state.debts.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-foreground">{d.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">{formatBRL(d.value)}</span>
                  <button onClick={() => financeActions.removeDebt(d.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOpen("asset")}
            className="rounded-2xl border-2 border-dashed border-border py-4 text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Bem
          </button>
          <button
            onClick={() => setOpen("debt")}
            className="rounded-2xl border-2 border-dashed border-border py-4 text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Dívida
          </button>
        </div>
      </div>

      {open === "asset" && <AddAsset onClose={() => setOpen(null)} />}
      {open === "debt" && <AddDebt onClose={() => setOpen(null)} />}
    </AppShell>
  );
}

function AddAsset({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<AssetType>("conta");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  return (
    <Sheet onClose={onClose} title="Novo bem">
      <Field label="Tipo">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
          {TYPES.map((t) => <option key={t} value={t}>{ASSET_LABELS[t]}</option>)}
        </select>
      </Field>
      <Field label="Nome">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Carro Honda" />
      </Field>
      <Field label="Valor (R$)">
        <input type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <button
        className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold"
        onClick={() => {
          if (!name || !value) return;
          financeActions.addAsset({ type, name, value: Number(value) });
          onClose();
        }}
      >
        Adicionar bem
      </button>
    </Sheet>
  );
}

function AddDebt({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  return (
    <Sheet onClose={onClose} title="Nova dívida">
      <Field label="Nome">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Empréstimo" />
      </Field>
      <Field label="Valor (R$)">
        <input type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <button
        className="w-full rounded-2xl bg-destructive text-destructive-foreground py-3.5 font-bold"
        onClick={() => {
          if (!name || !value) return;
          financeActions.addDebt({ name, value: Number(value) });
          onClose();
        }}
      >
        Adicionar dívida
      </button>
    </Sheet>
  );
}

function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-12 rounded-full bg-muted mx-auto" />
        <h2 className="text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}