import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppShell, PageHeader } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { authorizeSandbox } from '@/services/openfinance/openfinance.functions';
import { refreshFromCloud } from '@/lib/finance-store';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/autorizar')({validateSearch:(search:Record<string,unknown>)=>({state:typeof search['state']==='string'?search['state']:''}),head:()=>finluxMeta('Autorização Sandbox — Finlux','Simulação explícita de consentimento; nenhuma senha ou conta bancária real é utilizada.'),component:Authorization});
function Authorization() {
  const {state}=Route.useSearch(); const {user}=useAuth(); const fn=useServerFn(authorizeSandbox);const navigate=useNavigate(); const client=useQueryClient();const [busy,setBusy]=useState(false),[failure,setFailure]=useState('');
  async function decide(decision:'allow'|'deny') {
    setBusy(true);setFailure('');
    try {
      const raw=sessionStorage.getItem('finlux:of:pending'); const pending=raw?JSON.parse(raw):null;
      if (!pending || pending.state!==state || pending.userId!==user?.id) throw new Error('Esta autorização expirou ou pertence a outra sessão. Inicie uma nova conexão.');
      await fn({data:{connectionId:pending.connectionId,state,decision}});
      sessionStorage.removeItem('finlux:of:pending'); await client.invalidateQueries({queryKey:['open-finance']});await refreshFromCloud();
      toast.success(decision==='allow'?'Conexão Sandbox autorizada e dados fictícios sincronizados.':'Consentimento recusado. Nenhum dado importado.');
      await navigate({to:'/open-finance'});
    } catch(e){setFailure(e instanceof Error?e.message:'Não foi possível concluir a autorização.');}finally{setBusy(false)}
  }
  return <AppShell><PageHeader title="Autorização simulada" subtitle="MODO SANDBOX"/><section className="px-6 space-y-5"><FlaskConical className="h-12 w-12 text-primary"/><h2 className="text-xl font-bold">Nenhuma conexão bancária real</h2><p className="text-sm text-muted-foreground">Este ambiente de teste representa a etapa de autorização. Em produção, você será direcionado ao ambiente oficial da instituição ou do provedor. O Finlux nunca solicita sua senha bancária.</p><div className="flex gap-3 text-sm"><ShieldCheck className="text-primary shrink-0"/><p>Autorizar dados fictícios de contas, saldos, movimentações, cartões e faturas por 90 dias. Você pode revogar depois.</p></div>{failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}<Button className="w-full h-12 rounded-full" disabled={busy || !user} onClick={()=>void decide('allow')}>{busy?'Processando…':'Autorizar dados fictícios'}</Button><Button variant="outline" className="w-full h-12 rounded-full" disabled={busy || !user} onClick={()=>void decide('deny')}>Recusar consentimento</Button><Button asChild variant="ghost"><Link to="/open-finance">Voltar ao Finlux</Link></Button></section></AppShell>;
}