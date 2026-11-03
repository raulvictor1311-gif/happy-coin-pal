import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/privacidade')({head:()=>finluxMeta('Privacidade e segurança — Finlux','Entenda quais dados são utilizados, para qual finalidade e como cancelar o acesso.'),component:()=> <OFWorkspace view="privacy"/>});