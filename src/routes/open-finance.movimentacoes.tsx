import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/movimentacoes')({head:()=>finluxMeta('Movimentações importadas — Finlux','Revise categorias, transferências e possíveis duplicidades do Open Finance.'),component:()=> <OFWorkspace view="transactions"/>});