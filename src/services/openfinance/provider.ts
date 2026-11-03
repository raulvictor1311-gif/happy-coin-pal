import { z } from 'zod';

export const OF_CATEGORIES = ['Alimentação','Transporte','Moradia','Saúde','Educação','Lazer','Compras','Assinaturas','Serviços','Investimentos','Transferências','Outros'] as const;
export interface Institution { id: string; name: string; logo?: string }
const money = z.number().finite().min(0).max(1e12);
const id = z.string().min(1).max(200);
export const snapshotSchema = z.object({
  accounts: z.array(z.object({ id, name: z.string().max(120), type: z.string().max(50), balance: z.number().finite().min(-1e12).max(1e12) })).max(100),
  transactions: z.array(z.object({ id, account_id: id, date: z.string().datetime(), description: z.string().max(500), amount: money, kind: z.enum(['receita','despesa','transferencia']), category: z.string().max(80), status: z.enum(['posted','pending']) })).max(500),
  cards: z.array(z.object({ id, name: z.string().max(120), brand: z.string().max(50), total_limit: money, available_limit: money, used_limit: money, due_date: z.string(), closing_date: z.string() })).max(100),
  invoices: z.array(z.object({ id, card_id: id, total: money, paid: money, due_date: z.string(), closing_date: z.string(), status: z.enum(['open','paid','overdue']) })).max(100),
  card_transactions: z.array(z.object({ id, card_id: id, invoice_id: id, date: z.string().datetime(), description: z.string().max(500), amount: money, category: z.string().max(80), installments: z.number().int().min(1).max(120), installment_number: z.number().int().min(1).max(120) })).max(500),
});
export type ProviderSnapshot = z.infer<typeof snapshotSchema>;
export interface OpenFinanceProvider {
  readonly name: string;
  readonly environment: 'sandbox' | 'production';
  listInstitutions(query: string): Promise<Institution[]>;
  createConnection(institutionId: string, state: string): Promise<{ authorizationPath: string }>;
  getConnectionStatus(externalId: string): Promise<'active' | 'expired'>;
  getAccounts(externalId: string): Promise<ProviderSnapshot['accounts']>;
  getBalances(externalId: string): Promise<ProviderSnapshot['accounts']>;
  getTransactions(externalId: string, since?: string): Promise<ProviderSnapshot['transactions']>;
  getCreditCards(externalId: string): Promise<ProviderSnapshot['cards']>;
  getInvoices(externalId: string): Promise<ProviderSnapshot['invoices']>;
  getCardTransactions(externalId: string, since?: string): Promise<ProviderSnapshot['card_transactions']>;
  refreshConnection(externalId: string): Promise<void>;
  disconnect(externalId: string): Promise<void>;
}