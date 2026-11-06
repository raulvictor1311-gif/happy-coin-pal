import { describe,it,expect,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { OpenFinanceService,stateHash,providerForEnvironment } from './service.server';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{rpc}}));
function client(owner:string) {
 const filters:Record<string,string>={};
 const query={select:vi.fn(()=>query),eq:vi.fn((k:string,v:string)=>{filters[k]=v;return query}),maybeSingle:vi.fn(async()=>({error:null,data:filters['user_id']===owner?{id:'connection',user_id:owner,institution_id:'aurora-demo',environment:'sandbox',status:'active',expires_at:new Date(Date.now()+86400000).toISOString(),last_sync_at:new Date().toISOString()}:null}))};
 return {db:{from:()=>query} as unknown as SupabaseClient<Database>,filters};
}
describe('Open Finance authenticated service',()=>{
 it('user A cannot access user B connection',async()=>{const {db,filters}=client('B');await expect(new OpenFinanceService(db,'A').ownedConnection('connection')).rejects.toThrow('Conexão indisponível');expect(filters['user_id']).toBe('A')});
 it('unauthorized disconnect never reaches privileged command',async()=>{rpc.mockClear();const {db}=client('B');await expect(new OpenFinanceService(db,'A').disconnect('connection',false)).rejects.toThrow();expect(rpc).not.toHaveBeenCalled()});
 it('recent sync returns cache instead of calling provider or write command',async()=>{rpc.mockClear();const {db}=client('A');expect(await new OpenFinanceService(db,'A').sync('connection')).toEqual({cached:true});expect(rpc).not.toHaveBeenCalled()});
 it('invalid/replayed authorization is rejected, not accepted',async()=>{rpc.mockResolvedValueOnce({error:{message:'invalid_authorization'},data:null});const {db}=client('A');await expect(new OpenFinanceService(db,'A').authorize('connection','a'.repeat(64),'allow')).rejects.toThrow('já utilizada ou expirada')});
 it('authorization state uses a one-way hash rather than raw value',()=>{const raw='a'.repeat(64);expect(stateHash(raw)).toHaveLength(64);expect(stateHash(raw)).not.toBe(raw);expect(stateHash(raw)).not.toBe(stateHash('b'.repeat(64)))});
 it('production configuration fails closed',()=>{vi.stubEnv('OPEN_FINANCE_ENVIRONMENT','production');expect(()=>providerForEnvironment()).toThrow('CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR');vi.unstubAllEnvs()});
});