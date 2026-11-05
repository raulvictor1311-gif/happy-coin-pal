import { createFileRoute } from '@tanstack/react-router';
/** No production callback is trusted until the official provider contract is implemented. */
export const Route = createFileRoute('/api/public/open-finance/callback')({server:{handlers:{
  GET:async()=>new Response('CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR',{status:503,headers:{'Cache-Control':'no-store'}}),
  POST:async()=>new Response('CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR',{status:503,headers:{'Cache-Control':'no-store'}}),
}}});