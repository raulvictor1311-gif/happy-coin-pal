import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/faturas')({head:()=>finluxMeta('Faturas — Open Finance Finlux','Cartões conectados, limites, faturas e vencimentos autorizados.'),component:()=> <OFWorkspace view="invoices"/>});