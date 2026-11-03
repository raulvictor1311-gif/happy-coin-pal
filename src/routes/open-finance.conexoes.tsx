import { createFileRoute } from '@tanstack/react-router';
import { OFWorkspace } from '@/components/open-finance-workspace';
import { finluxMeta } from '@/lib/route-meta';
export const Route = createFileRoute('/open-finance/conexoes')({head:()=>finluxMeta('Instituições conectadas — Finlux','Atualize, renove autorizações ou desconecte suas instituições.'),component:()=> <OFWorkspace view="connections"/>});