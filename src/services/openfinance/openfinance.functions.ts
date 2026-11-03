import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { OpenFinanceService, providerForEnvironment } from './service.server';
import { OF_CATEGORIES } from './provider';

export const listOpenFinance = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(({context})=>new OpenFinanceService(context.supabase,context.userId).list());
export const listInstitutions = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({query:z.string().max(100)})).handler(async ({data})=>providerForEnvironment().listInstitutions(data.query));
export const beginConnection = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({institutionId:z.string().min(1).max(200),consent:z.literal(true),reconnectId:z.string().uuid().optional()})).handler(({data,context})=>new OpenFinanceService(context.supabase,context.userId).begin(data.institutionId,data.reconnectId));
export const authorizeSandbox = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({connectionId:z.string().uuid(),state:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['allow','deny'])})).handler(({data,context})=>new OpenFinanceService(context.supabase,context.userId).authorize(data.connectionId,data.state,data.decision));
export const syncConnection = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({connectionId:z.string().uuid()})).handler(({data,context})=>new OpenFinanceService(context.supabase,context.userId).sync(data.connectionId));
export const disconnectConnection = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({connectionId:z.string().uuid(),removeHistory:z.boolean()})).handler(({data,context})=>new OpenFinanceService(context.supabase,context.userId).disconnect(data.connectionId,data.removeHistory));
export const changeOpenFinance = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.discriminatedUnion('action',[
  z.object({action:z.literal('toggle'),connection_id:z.string().uuid(),resource_id:z.string().uuid(),included:z.boolean()}),
  z.object({action:z.literal('resolve'),connection_id:z.string().uuid(),resource_id:z.string().uuid(),table:z.enum(['financial_transactions','credit_card_transactions']),review_status:z.enum(['accepted','ignored']),replace_manual:z.boolean().optional(),category:z.enum(OF_CATEGORIES).optional()}),
])).handler(({data,context})=>new OpenFinanceService(context.supabase,context.userId).change(data.action,data));