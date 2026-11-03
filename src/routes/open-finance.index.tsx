import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/')({head:()=>finluxMeta('Open Finance — Finlux Finance','Conecte instituições, gerencie consentimentos e consolide suas finanças. Sandbox claramente identificado.'),component:()=> <OFWorkspace/>});