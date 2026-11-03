import type { Database } from '@/integrations/supabase/types';
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Connection = Omit<Row<'financial_connections'>,'authorization_hash'|'authorization_expires_at'|'external_connection_id'>;
export interface OpenFinanceData {
  environment: 'sandbox' | 'production'; configured: boolean;
  connections: Connection[];
  accounts: Row<'financial_accounts'>[];
  cards: Row<'credit_cards'>[];
  invoices: Row<'credit_card_invoices'>[];
  transactions: Row<'financial_transactions'>[];
  cardTransactions: Row<'credit_card_transactions'>[];
  consents: Row<'open_finance_consents'>[];
}
export const emptyOpenFinance: OpenFinanceData = {environment:'sandbox',configured:true,connections:[],accounts:[],cards:[],invoices:[],transactions:[],cardTransactions:[],consents:[]};