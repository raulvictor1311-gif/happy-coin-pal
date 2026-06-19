export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1).replace(".", ",")}k`;
  return `${sign}${formatBRL(abs)}`;
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** SSR-safe greeting: returns a neutral value on the server to avoid
 * hydration mismatches; the client should compute the real one after mount. */
export function greeting(): string {
  if (typeof window === "undefined") return "Olá";
  return greetingFor(new Date());
}

export function monthLabel(d = new Date()): string {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}