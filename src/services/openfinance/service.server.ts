import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { createHash, randomBytes } from 'node:crypto';
import { snapshotSchema, type OpenFinanceProvider } from './provider';
import { SandboxProvider } from './providers/sandbox.provider';
import { productionProvider } from './providers/production.provider';
import type { OpenFinanceData } from './data';
import { categorize } from './mappers/transaction.mapper';

export function providerForEnvironment(): OpenFinanceProvider {
  const environment = process.env['OPEN_FINANCE_ENVIRONMENT'] ?? 'sandbox';
  const provider = process.env['OPEN_FINANCE_PROVIDER'] ?? 'sandbox';
  if (environment !== 'sandbox' || provider !== 'sandbox') return productionProvider();
  return new SandboxProvider();
}
export const stateHash = (state: string) => createHash('sha256').update(state).digest('hex');
export class OpenFinanceService {
  constructor(private client: SupabaseClient<Database>, private userId: string) {}
  private async command(action: string, data: Record<string, unknown>) {
    // Verified user identity is supplied by requireSupabaseAuth, never the browser.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('of_command',{p_user:this.userId,p_action:action,p_data:data as never});
    if (error) {
      if (error.message.includes('rate_limit')) throw new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
      if (error.message.includes('invalid_authorization')) throw new Error('Autorização inválida, já utilizada ou expirada. Inicie uma nova conexão.');
      if (error.code==='23505') throw new Error('Esta instituição já possui uma conexão. Use Gerenciar.');
      throw new Error('Não foi possível concluir esta operação. Verifique a conexão e tente novamente.');
    }
    return result as { id: string; cached?: boolean };
  }
  async ownedConnection(id: string) {
    const { data,error } = await this.client.from('financial_connections').select('*').eq('id',id).eq('user_id',this.userId).maybeSingle();
    if (error || !data) throw new Error('Conexão indisponível para esta conta.');
    return data;
  }
  async list(): Promise<OpenFinanceData> {
    const tables = ['financial_connections','financial_accounts','credit_cards','credit_card_invoices','financial_transactions','credit_card_transactions','open_finance_consents'] as const;
    const results = await Promise.all(tables.map(table=>this.client.from(table).select('*').eq('user_id',this.userId).order('updated_at',{ascending:false}).limit(table.includes('transactions')?500:200)));
    if (results.some(r=>r.error)) throw new Error('Não conseguimos carregar seus dados agora. Tente novamente.');
    const connections = (results[0].data ?? []) as Database['public']['Tables']['financial_connections']['Row'][];
    for (const c of connections) if (c.status==='active' && c.expires_at && Date.parse(c.expires_at)<=Date.now()) await this.command('expire',{connection_id:c.id});
    const safe = connections.map(({authorization_hash:_h,authorization_expires_at:_e,external_connection_id:_x,...c})=>({...c,status:c.status==='active' && c.expires_at && Date.parse(c.expires_at)<=Date.now()?'expired':c.status}));
    return {environment:(process.env['OPEN_FINANCE_ENVIRONMENT'] ?? 'sandbox')==='sandbox'?'sandbox':'production',configured:(!process.env['OPEN_FINANCE_PROVIDER'] || process.env['OPEN_FINANCE_PROVIDER']==='sandbox') && (!process.env['OPEN_FINANCE_ENVIRONMENT'] || process.env['OPEN_FINANCE_ENVIRONMENT']==='sandbox'),connections:safe,accounts:results[1].data as OpenFinanceData['accounts'],cards:results[2].data as OpenFinanceData['cards'],invoices:results[3].data as OpenFinanceData['invoices'],transactions:results[4].data as OpenFinanceData['transactions'],cardTransactions:results[5].data as OpenFinanceData['cardTransactions'],consents:results[6].data as OpenFinanceData['consents']};
  }
  async begin(institutionId: string, reconnectId?: string) {
    const provider = providerForEnvironment();
    const institutions = await provider.listInstitutions('');
    const institution = institutions.find(i=>i.id===institutionId);
    if (!institution) throw new Error('Instituição não disponível.');
    const state = randomBytes(32).toString('hex');
    let authorization;
    try { authorization = await provider.createConnection(institutionId,state); }
    catch { throw new Error('Esta instituição está indisponível agora. Tente novamente em alguns minutos.'); }
    const payload = {institution_id:institution.id,institution_name:institution.name,hash:stateHash(state)};
    const result = reconnectId ? (await this.ownedConnection(reconnectId), await this.command('reconnect',{...payload,connection_id:reconnectId})) : await this.command('begin',payload);
    return { connectionId:result.id, state, authorizationPath:authorization.authorizationPath };
  }
  async authorize(id: string, state: string, decision: 'allow'|'deny') {
    const c = await this.ownedConnection(id);
    if (c.environment!=='sandbox') throw new Error('CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR');
    await this.command('authorize',{connection_id:id,hash:stateHash(state),decision});
    if (decision==='allow') await this.sync(id);
    return {authorized:decision==='allow'};
  }
  async sync(id: string) {
    const c = await this.ownedConnection(id);
    if (c.status!=='active' || !c.expires_at || Date.parse(c.expires_at)<=Date.now()) throw new Error('Precisamos que você autorize novamente o acesso a esta instituição.');
    if (c.last_sync_at && Date.now()-Date.parse(c.last_sync_at)<30000) return {cached:true};
    const provider = providerForEnvironment();
    try {
      if (await provider.getConnectionStatus(c.external_connection_id ?? id)!=='active') throw new Error('consent_expired');
      await provider.refreshConnection(c.external_connection_id ?? id);
      // Overlap covers late/revised records; stable external IDs make repeated pages idempotent.
      const since = c.last_sync_at ? new Date(Date.parse(c.last_sync_at)-7*86400000).toISOString() : undefined;
      const [accounts,transactions,cards,invoices,card_transactions] = await Promise.all([provider.getBalances(id),provider.getTransactions(id,since),provider.getCreditCards(id),provider.getInvoices(id),provider.getCardTransactions(id,since)]);
      const { data: history } = await this.client.from('financial_transactions').select('description,category').eq('user_id',this.userId).eq('manually_categorized',true).limit(500);
      const snapshot = snapshotSchema.parse({accounts,transactions:transactions.map(t=>({...t,category:t.kind==='transferencia'?'Transferências':categorize(t.description,history ?? [])})),cards,invoices,card_transactions});
      return await this.command('sync',{connection_id:id,...snapshot});
    } catch {
      await this.command('error',{connection_id:id});
      throw new Error('Não conseguimos atualizar seus dados agora. Tente novamente em alguns minutos.');
    }
  }
  async disconnect(id: string, removeHistory: boolean) {
    const c = await this.ownedConnection(id);
    await providerForEnvironment().disconnect(c.external_connection_id ?? id);
    return this.command('disconnect',{connection_id:id,remove_history:removeHistory});
  }
  async change(action: 'toggle'|'resolve', payload: Record<string,unknown> & {connection_id:string}) {
    await this.ownedConnection(payload.connection_id);
    return this.command(action,payload);
  }
}