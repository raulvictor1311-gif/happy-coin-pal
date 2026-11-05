import { describe, expect, it, vi } from 'vitest';
vi.mock('@/services/openfinance/openfinance.functions',()=>({listOpenFinance:vi.fn()}));
import { mergeOpenFinance } from './finance.mapper';
import { duplicateCandidate,categorize } from './mappers/transaction.mapper';
import { SandboxProvider,sandboxSnapshot } from './providers/sandbox.provider';
import { snapshotSchema } from './provider';
import { emptyOpenFinance, type OpenFinanceData } from './data';
import { accountBalance,committedTotal,getMonthlySummary,freeBalance,projectedBalance,type FinanceState } from '@/lib/finance-store';

const date=new Date().toISOString();
const base={transactions:[],cards:[],assets:[],debts:[],goals:[],installmentPurchases:[],monthlyIncome:0,installmentAlertPct:30} as unknown as FinanceState;
function fixture():OpenFinanceData {
  const s=sandboxSnapshot();
  return {...emptyOpenFinance,connections:[{id:'c',user_id:'owner',status:'active',environment:'sandbox',expires_at:new Date(Date.now()+86400000).toISOString()} as OpenFinanceData['connections'][number]],accounts:s.accounts.map(a=>({...a,user_id:'owner',connection_id:'c',included:true})) as OpenFinanceData['accounts'],cards:s.cards.map(c=>({...c,user_id:'owner',connection_id:'c',included:true})) as OpenFinanceData['cards'],transactions:s.transactions.map(t=>({...t,user_id:'owner',connection_id:'c',review_status:'accepted'})) as OpenFinanceData['transactions'],cardTransactions:s.card_transactions.map(t=>({...t,user_id:'owner',connection_id:'c',review_status:'accepted',invoice_paid:false})) as OpenFinanceData['cardTransactions']};
}
describe('Open Finance rules',()=>{
 it('keeps provider data valid and labelled sandbox',()=>{expect(snapshotSchema.parse(sandboxSnapshot()).accounts[0].balance).toBe(2450.30);expect(new SandboxProvider().environment).toBe('sandbox')});
 it('current balances are 3770.80, not the historical income less expenses',()=>{expect(accountBalance(mergeOpenFinance(base,fixture()))).toBeCloseTo(3770.80)});
 it('cards commit 1280 once without debiting account',()=>{const s=mergeOpenFinance(base,fixture());expect(committedTotal(s)).toBe(1280);expect(accountBalance(s)).toBeCloseTo(3770.80)});
 it('available and projected exclude card commitment once',()=>{const s=mergeOpenFinance(base,fixture());expect(freeBalance(s)).toBeCloseTo(2490.80);expect(projectedBalance(s)).toBeCloseTo(2490.80)});
 it('internal transfers do not become expense or income',()=>{const s=getMonthlySummary(mergeOpenFinance(base,fixture()));expect(s.income).toBe(5000);expect(s.expense).toBe(1430)});
 it('unselected accounts do not enter totals',()=>{const f=fixture();f.accounts.forEach(a=>a.included=false);expect(accountBalance(mergeOpenFinance(base,f))).toBe(0)});
 it('unresolved duplicates are excluded from expenses',()=>{const f=fixture();f.transactions[1].review_status='possible_duplicate';expect(getMonthlySummary(mergeOpenFinance(base,f)).expense).toBe(1280)});
 it('revoked/disconnected connections stop contributing',()=>{const f=fixture();f.connections[0].status='disconnected';expect(accountBalance(mergeOpenFinance(base,f))).toBe(0);expect(committedTotal(mergeOpenFinance(base,f))).toBe(0)});
 it('expired consent stops contributing',()=>{const f=fixture();f.connections[0].expires_at='2020-01-01T00:00:00Z';expect(accountBalance(mergeOpenFinance(base,f))).toBe(0)});
 it('same value date and supermarket description flags potential duplicate',()=>{expect(duplicateCandidate({amount:150,date,description:'Supermercado'},{amount:150,date,description:'SUPERMERCADO XYZ'})).toBe('likely')});
 it('different known accounts cannot match',()=>{expect(duplicateCandidate({amount:150,date,description:'mercado',accountId:'A'},{amount:150,date,description:'mercado',accountId:'B'})).toBe('none')});
 it('amount mismatch cannot match',()=>{expect(duplicateCandidate({amount:150,date,description:'mercado'},{amount:151,date,description:'mercado'})).toBe('none')});
 it('learns explicit user categories',()=>{expect(categorize('LOJA XYZ',[{description:'Loja xyz',category:'Saúde'}])).toBe('Saúde')});
 it('maps supermarket to Alimentação',()=>{expect(categorize('SUPERMERCADO XYZ')).toBe('Alimentação')});
 it('manual record is replaced in totals only when imported counterpart selected',()=>{const f=fixture();const t=f.transactions[1];const manual={...base,transactions:[{id:'manual',kind:'despesa' as const,amount:150,date,description:'Supermercado',category:'Alimentação',reconciledOpenFinanceId:t.id}]};expect(mergeOpenFinance(manual,f).transactions.filter(x=>x.id==='manual')).toHaveLength(0);f.accounts.forEach(a=>a.included=false);expect(mergeOpenFinance(manual,f).transactions.filter(x=>x.id==='manual')).toHaveLength(1)});
 it('same snapshot merge does not mutate or append to manual state',()=>{const f=fixture();expect(mergeOpenFinance(base,f).transactions).toHaveLength(4);expect(mergeOpenFinance(base,f).transactions).toHaveLength(4);expect(base.transactions).toHaveLength(0)});
 it('unsupported and unavailable institutions fail safely',async()=>{const p=new SandboxProvider();await expect(p.createConnection('unknown','state')).rejects.toThrow('institution_unsupported');await expect(p.createConnection('timeout-demo','state')).rejects.toThrow('provider_unavailable')});
});