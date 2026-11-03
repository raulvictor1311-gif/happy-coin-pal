import { Link } from '@tanstack/react-router';
import { FlaskConical } from 'lucide-react';
import { useFinance } from '@/lib/finance-store';
export function OpenFinanceNotice() {
  const state = useFinance();
  if (!state.openFinanceSandbox) return null;
  return <Link to="/open-finance" className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary"><FlaskConical className="h-4 w-4 shrink-0"/><span>MODO SANDBOX · Os totais incluem dados fictícios selecionados. Lançamentos manuais não vinculados são somados separadamente.</span></Link>;
}