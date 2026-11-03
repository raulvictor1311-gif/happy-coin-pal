import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/contas')({head:()=>finluxMeta('Minhas contas — Open Finance Finlux','Consulte contas, saldos e escolha quais dados entram nos cálculos do Finlux.'),component:()=> <OFWorkspace view="accounts"/>});