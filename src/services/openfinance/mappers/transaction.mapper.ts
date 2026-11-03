import { OF_CATEGORIES } from '../provider';
export const normalizeDescription = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function categorize(description: string, history: { description: string; category: string }[] = []): string {
  const normalized = normalizeDescription(description);
  const learned = history.find(t => normalizeDescription(t.description) === normalized && t.category !== 'Outros');
  if (learned) return learned.category;
  const rules: [RegExp, string][] = [[/mercado|restaurante|ifood|padaria/,'Alimentação'],[/uber|posto|combustivel|onibus/,'Transporte'],[/aluguel|condominio|energia/,'Moradia'],[/farmacia|hospital|clinica/,'Saúde'],[/escola|curso|faculdade/,'Educação'],[/cinema|teatro/,'Lazer'],[/netflix|spotify|assinatura/,'Assinaturas'],[/loja|shopping/,'Compras'],[/investimento|aplicacao/,'Investimentos']];
  return rules.find(([rule]) => rule.test(normalized))?.[1] ?? 'Outros';
}
export function duplicateCandidate(a: { amount: number; date: string; description: string; accountId?: string; institutionId?: string }, b: { amount: number; date: string; description: string; accountId?: string; institutionId?: string }): 'none' | 'possible' | 'likely' {
  if (Math.round(a.amount*100) !== Math.round(b.amount*100) || Math.abs(Date.parse(a.date)-Date.parse(b.date))>3*86400000) return 'none';
  if ((a.accountId && b.accountId && a.accountId!==b.accountId) || (a.institutionId && b.institutionId && a.institutionId!==b.institutionId)) return 'none';
  const words = normalizeDescription(a.description).split(' ').filter(w=>w.length>2);
  return words.some(w=>normalizeDescription(b.description).includes(w)) ? 'likely' : 'possible';
}
export function validCategory(category: string) { return OF_CATEGORIES.includes(category as typeof OF_CATEGORIES[number]); }