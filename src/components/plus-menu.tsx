import { Link } from "@tanstack/react-router";
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { useEffect } from "react";

interface PlusMenuProps {
  open: boolean;
  onClose: () => void;
}

export function PlusMenu({ open, onClose }: PlusMenuProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    {
      to: "/nova",
      search: { kind: "receita" as const },
      label: "Receita",
      desc: "Salário, freelance, rendimentos",
      icon: ArrowDownLeft,
      color: "var(--color-success)",
    },
    {
      to: "/nova",
      search: { kind: "despesa" as const },
      label: "Despesa",
      desc: "Compras, contas, assinaturas",
      icon: ArrowUpRight,
      color: "var(--color-destructive)",
    },
    {
      to: "/nova",
      search: { kind: "transferencia" as const },
      label: "Transferência",
      desc: "Entre contas ou pessoas",
      icon: ArrowLeftRight,
      color: "var(--color-primary)",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] bg-card border-t border-border p-6 pb-10 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Nova
            </p>
            <h2 className="text-xl font-bold text-foreground mt-1">O que registrar?</h2>
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-card-elevated flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it) => (
            <Link
              key={it.label}
              to={it.to}
              search={it.search as any}
              onClick={onClose}
              className="flex items-center gap-4 rounded-2xl bg-card-elevated p-4 hover:bg-muted transition-all active:scale-[0.98]"
            >
              <span
                className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `color-mix(in oklab, ${it.color} 18%, transparent)` }}
              >
                <it.icon className="h-5 w-5" style={{ color: it.color }} strokeWidth={2.4} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{it.label}</p>
                <p className="text-xs text-muted-foreground truncate">{it.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
