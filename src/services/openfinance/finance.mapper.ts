import type { FinanceState, Transaction } from '@/lib/finance-store';
import type { OpenFinanceData } from './data';

/** Snapshots are cash balances, not artificial income. Original manual rows remain untouched. */
export function mergeOpenFinance(state: FinanceState, data?: OpenFinanceData): FinanceState {
  if (!data) return state;
  const active = new Set(data.connections.filter(c=>c.status==='active' && c.expires_at && Date.parse(c.expires_at)>Date.now()).map(c=>c.id));
  const accounts = data.accounts.filter(a=>a.included && active.has(a.connection_id));
  const cards = data.cards.filter(a=>a.included && active.has(a.connection_id));
  const accountIds = new Set(accounts.map(a=>a.id));
  const cardIds = new Set(cards.map(a=>a.id));
  const cash: Transaction[] = data.transactions.filter(t=>accountIds.has(t.account_id) && t.kind!=='transferencia' && t.review_status==='accepted' && t.status==='posted').map(t=>({id:t.id,kind:t.kind==='receita'?'receita':'despesa',amount:Number(t.amount),category:t.category,description:t.description,date:t.date,source:'open_finance',financialAccountId:t.account_id,snapshotCovered:true,sandbox:data.connections.some(c=>c.id===t.connection_id && c.environment==='sandbox')}));
  const purchases: Transaction[] = data.cardTransactions.filter(t=>cardIds.has(t.card_id) && t.review_status==='accepted').map(t=>({id:t.id,kind:'despesa',amount:Number(t.amount),category:t.category,description:t.description,date:t.date,cardId:t.card_id,invoicePaid:t.invoice_paid,source:'open_finance',snapshotCovered:true,sandbox:data.connections.some(c=>c.id===t.connection_id && c.environment==='sandbox')}));
  const includedImportedIds = new Set([...cash,...purchases].map(t=>t.id));
  const manual = state.transactions.filter(t=>!t.reconciledOpenFinanceId || !includedImportedIds.has(t.reconciledOpenFinanceId));
  return {...state,transactions:[...manual,...cash,...purchases].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),cards:[...state.cards,...cards.map(c=>({id:c.id,name:c.name,brand:c.brand,limit:Number(c.total_limit),closingDay:new Date(c.closing_date ?? '').getUTCDate() || 1,dueDay:new Date(c.due_date ?? '').getUTCDate() || 1,color:'',debitMode:'on_payment' as const,source:'open_finance' as const}))],openFinance:data,openFinanceBalance:accounts.reduce((s,a)=>s+Number(a.balance),0),openFinanceCommitted:cards.reduce((s,c)=>s+Number(c.used_limit),0),openFinanceSandbox:[...accounts,...cards].some(a=>data.connections.some(c=>c.id===a.connection_id && c.environment==='sandbox'))};
}