import { createFileRoute } from '@tanstack/react-router';
/** Fail closed. Official signature verification and replay store must precede activation. */
export const Route = createFileRoute('/api/public/open-finance/webhook')({server:{handlers:{POST:async()=>new Response('CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR',{status:503,headers:{'Cache-Control':'no-store'}})}}});