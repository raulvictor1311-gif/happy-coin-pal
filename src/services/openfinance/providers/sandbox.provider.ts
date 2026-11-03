import type { OpenFinanceProvider, ProviderSnapshot } from '../provider';
import { categorize } from '../mappers/transaction.mapper';

/** Fictional institutions only. This catalogue belongs to the adapter, never the UI. */
const institutions = [{ id: 'aurora-demo', name: 'Banco Aurora · fictício' }, { id: 'verde-demo', name: 'Conta Verde · fictícia' }, { id: 'timeout-demo', name: 'Instituição indisponível · teste' }];
export function sandboxSnapshot(ref = new Date()): ProviderSnapshot {
  const month = ref.toISOString().slice(0,7);
  const date = new Date(ref.getFullYear(),ref.getMonth(),Math.max(1,ref.getDate()-1),12).toISOString();
  const due = new Date(ref.getFullYear(),ref.getMonth()+1,10).toISOString().slice(0,10);
  const close = new Date(ref.getFullYear(),ref.getMonth()+1,3).toISOString().slice(0,10);
  return {
    accounts: [{id:'checking',name:'Conta principal fictícia',type:'Conta corrente',balance:2450.30},{id:'savings',name:'Reserva fictícia',type:'Poupança',balance:1320.50}],
    transactions: [
      {id:`salary-${month}`,account_id:'checking',date,description:'Salário demonstrativo',amount:5000,kind:'receita',category:'Outros',status:'posted'},
      {id:`market-${month}`,account_id:'checking',date,description:'SUPERMERCADO XYZ · exemplo',amount:150,kind:'despesa',category:categorize('SUPERMERCADO XYZ'),status:'posted'},
      {id:`transfer-out-${month}`,account_id:'checking',date,description:'Transferência entre minhas contas · exemplo',amount:500,kind:'transferencia',category:'Transferências',status:'posted'},
      {id:`transfer-in-${month}`,account_id:'savings',date,description:'Transferência entre minhas contas · exemplo',amount:500,kind:'transferencia',category:'Transferências',status:'posted'},
    ],
    cards:[{id:'card',name:'Aurora Platinum · fictício',brand:'Cartão de demonstração',total_limit:5000,available_limit:3720,used_limit:1280,due_date:due,closing_date:close}],
    invoices:[{id:`invoice-${month}`,card_id:'card',total:1280,paid:0,due_date:due,closing_date:close,status:'open'}],
    card_transactions:[{id:`purchase-${month}`,card_id:'card',invoice_id:`invoice-${month}`,date,description:'Loja exemplo · parcela 1/3',amount:1180,category:'Compras',installments:3,installment_number:1},{id:`subscription-${month}`,card_id:'card',invoice_id:`invoice-${month}`,date,description:'Assinatura demonstrativa',amount:100,category:'Assinaturas',installments:1,installment_number:1}],
  };
}
export class SandboxProvider implements OpenFinanceProvider {
  readonly name = 'sandbox'; readonly environment = 'sandbox' as const;
  async listInstitutions(query: string) { return institutions.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())); }
  async createConnection(institutionId: string, state: string) {
    if (!institutions.some(i=>i.id===institutionId)) throw new Error('institution_unsupported');
    if (institutionId==='timeout-demo') throw new Error('provider_unavailable');
    return { authorizationPath: `/open-finance/autorizar?state=${encodeURIComponent(state)}` };
  }
  async getConnectionStatus() { return 'active' as const; }
  async getAccounts() { return sandboxSnapshot().accounts; }
  async getBalances() { return sandboxSnapshot().accounts; }
  async getTransactions(_id: string, since?: string) { return sandboxSnapshot().transactions.filter(t=>!since || t.date>=since); }
  async getCreditCards() { return sandboxSnapshot().cards; }
  async getInvoices() { return sandboxSnapshot().invoices; }
  async getCardTransactions(_id: string, since?: string) { return sandboxSnapshot().card_transactions.filter(t=>!since || t.date>=since); }
  async refreshConnection() {}
  async disconnect() {}
}