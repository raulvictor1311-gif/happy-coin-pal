# Open Finance — Finlux Finance

## Status de entrega
Sandbox funcional; **nenhuma conexão bancária real**. Produção bloqueada deliberadamente: **CONFIGURAÇÃO NECESSÁRIA DO PROVEDOR**. A base pode receber um adaptador oficial, mas não constitui integração regulatória pronta para produção.

## Arquivos e estrutura
- `src/services/openfinance/provider.ts`: contrato e validação do formato normalizado.
- `providers/sandbox.provider.ts`: catálogo fictício e dados de demonstração.
- `providers/production.provider.ts`: bloqueio seguro até implementação oficial.
- `service.server.ts`: serviço de leitura, autorização, sincronização e revogação.
- `openfinance.functions.ts`: operações autenticadas; identidade extraída da sessão, nunca do formulário.
- `data.ts`, `finance.mapper.ts`, `mappers/transaction.mapper.ts`: tipos, conciliação da camada financeira e categorização.
- `src/components/open-finance-workspace.tsx`, `open-finance-sync.tsx`, `open-finance-notice.tsx`: telas, sincronização de conexões antigas e aviso de simulação.
- `src/routes/open-finance*.tsx`: área, contas, faturas, conexões, consentimentos, privacidade, movimentações e autorização Sandbox.
- Modificados: store financeiro, Mais, shell, raiz, extrato, cartões, contexto do Lux. Metadados específicos das páginas revisados.
- Migrações: `drizzle/migrations/0000_open_finance_foundation.sql`, `0001_open_finance_commands.sql`.

## Tabelas
`financial_connections`, `financial_accounts`, `financial_transactions`, `credit_cards`, `credit_card_invoices`, `credit_card_transactions`, `open_finance_consents`, `sync_logs`.
Reutiliza os usuários existentes; não cria outra tabela `users`. Transações manuais recebem `source`, `financial_account_id`, `financial_institution_id`, `reconciled_open_finance_id`.
Todos os registros de Open Finance são isolados por `user_id`, com RLS e chaves estrangeiras compostas para impedir vínculo entre usuários. Escritas são mediadas pelo serviço; função atômica `of_command` disponível somente ao papel de serviço. Logs contêm eventos, não payload bancário ou segredos.

## Operações / endpoints
RPCs autenticados: `listOpenFinance`, `listInstitutions`, `beginConnection`, `authorizeSandbox`, `syncConnection`, `disconnectConnection`, `changeOpenFinance`.
São funções TanStack, não APIs REST públicas.
`/api/public/open-finance/callback` (GET/POST) e `/api/public/open-finance/webhook` (POST) retornam 503 sem processar dados até o adaptador oficial existir. Não configure estes URLs no fornecedor antes dessa implementação.

## Sandbox
Nenhuma credencial necessária. Na ausência de configuração, ambiente e provedor são `sandbox`.
Mais → Open Finance → Conectar instituição → banco fictício → consentimento explícito → autorização simulada → importação persistida.
O estado de autorização é aleatório, 256 bits, hash SHA-256 no servidor, prazo de 10 minutos e consumo único. O retorno exige sessão autenticada e vínculo do usuário. Recusar não importa dados. Consentimento demonstrativo dura 90 dias; revogação interrompe sincronização.
Use a instituição indisponível para verificar erro amigável. Renovar autorização repete o consentimento. Conexões expiradas precisam de nova autorização.
Contas e cartões fictícios não entram no painel automaticamente: a seleção é explícita. Ao selecionar, todo app mostra o aviso Sandbox, inclusive contexto enviado ao Lux.

## Sincronização e cálculos
Consulta armazenada em cache por 60 segundos. Sincroniza conexões ativas antigas (15 minutos) enquanto o app está aberto/visível; não há tarefa agendada no servidor nesta entrega. Atualização manual respeita intervalo de 30 segundos, com trava atômica e IDs únicos. Dados incrementais usam sobreposição de sete dias para revisões; adaptador real precisa paginação e cursores oficiais.
Saldos importados são posições atuais, não receitas sintéticas. Movimentações cobertas pelo saldo não são deduzidas de novo. Transferências internas não são receitas/despesas. Crédito não debita saldo da conta; limite utilizado compõe o comprometido uma única vez. Datas futuras manuais mantêm lógica existente.
Duplicidades manuais de mesmo valor/tipo e até três dias são retidas para revisão; conta/instituição restringem correspondência quando disponíveis. Descrição fornece similaridade adicional. “É o mesmo lançamento” preserva manual no banco mas retira sua cópia dos cálculos enquanto a importação correspondente é selecionada. “São diferentes” confirma ambos; “Ignorar” mantém somente manual. Categoria corrigida fica preservada na próxima sincronização e alimenta regras aprendidas.
Valores manuais não vinculados a contas não podem ser conciliados automaticamente contra saldos reais: ficam separados. Ativos manuais de conta também precisam de conciliação antes de consolidar patrimônio real.
Histórico integral fica preservado nas tabelas; consulta atual tem teto de 500 transações por conjunto. Implementação de paginação remota completa, retenção/registros antigos e saldo histórico de snapshots é necessária antes de volumes reais elevados.

## Variáveis (somente servidor)
Configurar em **Lovable Cloud → Secrets**; nunca usar prefixo `VITE_`, código do navegador ou `.env` versionado.
| Nome | Finalidade |
| --- | --- |
| `OPEN_FINANCE_PROVIDER` | `sandbox` ou identificador do adaptador contratado |
| `OPEN_FINANCE_ENVIRONMENT` | `sandbox` / `production` |
| `OPEN_FINANCE_CLIENT_ID` | Identificador emitido pelo fornecedor |
| `OPEN_FINANCE_CLIENT_SECRET` | Credencial privada emitida pelo fornecedor |
| `OPEN_FINANCE_REDIRECT_URI` | URL HTTPS oficial de retorno validada no contrato |
| `OPEN_FINANCE_API_URL` | Base oficial da API, não inventada |

Os quatro últimos campos são reservados e ainda não consumidos: dependem do contrato real. Não coloque valores fictícios para fazê-los parecer configurados. Segredos técnicos devem usar gerenciamento de segredos; tokens por conexão, se exigidos, requerem criptografia com chave gerenciada, rotação e armazenamento inacessível ao navegador.

## Trocar para produção
1. Escolher provedor e obter documentação oficial, contrato e escopos disponíveis; verificar papel regulatório e instituição receptora.
2. Implementar `OpenFinanceProvider` com autenticação oficial e validação de respostas; não copiar a simulação OAuth para bancos reais.
3. Implementar callback oficial (state vinculado ao usuário, expiração, consumo único, PKCE conforme contrato) e webhook com assinatura e proteção contra replay persistente.
4. Configurar secrets, certificados/mTLS quando exigidos, URL HTTPS e redirecionamento autorizado.
5. Definir prazo/escopos reais, política de privacidade, retenção/exclusão, instituição receptora e limites oficiais. Os textos atuais se referem ao Sandbox.
6. Implementar paginação oficial, jobs duráveis, retries com backoff, limites por usuário/provedor, monitoramento, reconciliação de conta/manual e associação segura de cartões.
7. Executar testes com provedor homologado: expiração, replay, acesso cruzado, faturas pagas/parcelas, atualizações retroativas, transferência entre contas e sincronizações concorrentes.
8. Só depois ativar o adaptador e `production`. Mudar apenas as variáveis mantém o bloqueio 503/erro; não habilita uma integração inexistente.

## Limitações explícitas
- Sem OAuth bancário, webhook ativo, certificados, tokens bancários ou credenciais reais nesta entrega.
- Sem pagamentos, transferências automáticas, investimentos/crédito importados; interface pode ser estendida no futuro.
- Cache/incremento e sincronização automática com app aberto; não há background job durável.
- Testes locais não substituem homologação bancária, auditoria jurídica, pen-test e validação publicada.
- Assinaturas, criptografia de tokens e tempos/rate limits reais dependem do fornecedor escolhido. Rate limiting atual: dez inícios por hora/usuário e sincronização em intervalo de 30 segundos.