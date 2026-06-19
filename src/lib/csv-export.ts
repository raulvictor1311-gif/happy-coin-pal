import type { Transaction } from "./finance-store";

function escape(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function transactionsToCsv(txs: Transaction[]): string {
  const header = [
    "id",
    "tipo",
    "valor",
    "categoria",
    "descricao",
    "data",
    "metodo_pagamento",
    "cartao_id",
    "parcelas",
  ];
  const rows = txs.map((t) =>
    [
      t.id,
      t.kind,
      t.amount.toFixed(2).replace(".", ","),
      t.category,
      t.description,
      t.date,
      t.paymentMethod ?? "",
      t.cardId ?? "",
      t.installments ?? "",
    ]
      .map(escape)
      .join(";"),
  );
  return [header.join(";"), ...rows].join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
