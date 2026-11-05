import { useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { listOpenFinance, syncConnection } from '@/services/openfinance/openfinance.functions';
import { useAuth } from '@/hooks/use-auth';
/** Only stale active connections; no full provider sync on every page load. */
export function OpenFinanceSync() {
  const {user}=useAuth();const read=useServerFn(listOpenFinance),sync=useServerFn(syncConnection);const client=useQueryClient();
  useEffect(()=>{
    if (!user) return;
    let cancelled=false, running=false;
    const update=async()=>{
      if (cancelled || running || document.visibilityState!=='visible') return;
      running=true;
      try {
        const data=await client.fetchQuery({queryKey:['open-finance',user.id],queryFn:()=>read(),staleTime:60000});
        const stale=data.connections.filter(c=>c.status==='active' && (!c.last_sync_at || Date.now()-Date.parse(c.last_sync_at)>15*60000));
        for (const c of stale) {if(cancelled)break;await sync({data:{connectionId:c.id}})}
        if (stale.length && !cancelled) await client.invalidateQueries({queryKey:['open-finance',user.id]});
      } catch { /* Retain read cache; manual retry remains available. */ }
      finally {running=false}
    };
    void update();const timer=setInterval(()=>void update(),15*60000);
    return ()=>{cancelled=true;clearInterval(timer)};
  },[user?.id,client,read,sync]);
  return null;
}