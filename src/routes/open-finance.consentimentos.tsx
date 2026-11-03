import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/consentimentos')({head:()=>finluxMeta('Consentimentos — Open Finance Finlux','Consulte finalidade, período de acesso e revogue consentimentos.'),component:()=> <OFWorkspace view="consents"/>});