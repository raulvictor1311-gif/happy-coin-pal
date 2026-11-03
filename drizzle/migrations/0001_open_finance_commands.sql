CREATE FUNCTION public.of_command(p_user uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.financial_connections; cid uuid; x jsonb; aid uuid; kid uuid; iid uuid; mid uuid;
BEGIN
IF p_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
IF p_action='begin' THEN
 IF (SELECT count(*) FROM sync_logs WHERE user_id=p_user AND event='connection_started' AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'rate_limit'; END IF;
 INSERT INTO financial_connections(user_id,provider,institution_id,institution_name,environment,authorization_hash,authorization_expires_at,expires_at) VALUES(p_user,'sandbox',p_data->>'institution_id',p_data->>'institution_name','sandbox',p_data->>'hash',now()+interval '10 minutes',now()+interval '90 days') RETURNING id INTO cid;
 INSERT INTO open_finance_consents(user_id,connection_id,purpose,scopes,expires_at) VALUES(p_user,cid,'Organização financeira e insights do Lux IA',ARRAY['accounts','balances','transactions','cards','invoices'],now()+interval '90 days');
 INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,'connection_started'),(p_user,cid,'consent_created');
 RETURN jsonb_build_object('id',cid);
END IF;
cid=(p_data->>'connection_id')::uuid;
SELECT * INTO c FROM financial_connections WHERE id=cid AND user_id=p_user FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
IF p_action='authorize' THEN
 IF c.status<>'pending' OR c.authorization_hash IS NULL OR c.authorization_hash<>p_data->>'hash' OR c.authorization_expires_at<=now() THEN RAISE EXCEPTION 'invalid_authorization'; END IF;
 UPDATE financial_connections SET status=CASE WHEN p_data->>'decision'='allow' THEN 'active' ELSE 'disconnected' END,connected_at=now(),external_connection_id=cid::text,authorization_hash=NULL,authorization_expires_at=NULL,updated_at=now() WHERE id=cid;
 UPDATE open_finance_consents SET status=CASE WHEN p_data->>'decision'='allow' THEN 'active' ELSE 'revoked' END,authorized_at=CASE WHEN p_data->>'decision'='allow' THEN now() END,revoked_at=CASE WHEN p_data->>'decision'='deny' THEN now() END,updated_at=now() WHERE connection_id=cid AND status='pending';
 INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,CASE WHEN p_data->>'decision'='allow' THEN 'connection_authorized' ELSE 'connection_failed' END);
ELSIF p_action='reconnect' THEN
 IF c.status='disconnected' THEN RAISE EXCEPTION 'invalid_status'; END IF;
 UPDATE financial_connections SET status='pending',authorization_hash=p_data->>'hash',authorization_expires_at=now()+interval '10 minutes',expires_at=now()+interval '90 days',updated_at=now() WHERE id=cid;
 UPDATE open_finance_consents SET status='revoked',revoked_at=now(),updated_at=now() WHERE connection_id=cid AND status<>'revoked';
 INSERT INTO open_finance_consents(user_id,connection_id,purpose,scopes,expires_at) VALUES(p_user,cid,'Organização financeira e insights do Lux IA',ARRAY['accounts','balances','transactions','cards','invoices'],now()+interval '90 days');
 INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,'connection_refreshed'),(p_user,cid,'consent_created'),(p_user,cid,'consent_revoked');
ELSIF p_action='sync' THEN
 IF c.status<>'active' OR c.expires_at<=now() OR NOT EXISTS(SELECT 1 FROM open_finance_consents WHERE connection_id=cid AND status='active' AND expires_at>now()) THEN RAISE EXCEPTION 'consent_expired'; END IF;
 IF c.last_sync_at>now()-interval '30 seconds' THEN RETURN jsonb_build_object('cached',true); END IF;
 INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,'sync_started');
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'accounts') LOOP
 INSERT INTO financial_accounts(user_id,connection_id,external_id,name,type,balance,balance_at) VALUES(p_user,cid,x->>'id',x->>'name',x->>'type',(x->>'balance')::numeric,now()) ON CONFLICT(connection_id,external_id) DO UPDATE SET balance=excluded.balance,balance_at=now(),updated_at=now();
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'cards') LOOP
 INSERT INTO credit_cards(user_id,connection_id,external_id,name,brand,total_limit,available_limit,used_limit,due_date,closing_date) VALUES(p_user,cid,x->>'id',x->>'name',x->>'brand',(x->>'total_limit')::numeric,(x->>'available_limit')::numeric,(x->>'used_limit')::numeric,(x->>'due_date')::date,(x->>'closing_date')::date) ON CONFLICT(connection_id,external_id) DO UPDATE SET total_limit=excluded.total_limit,available_limit=excluded.available_limit,used_limit=excluded.used_limit,updated_at=now();
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'invoices') LOOP
 SELECT id INTO kid FROM credit_cards WHERE connection_id=cid AND external_id=x->>'card_id';
 INSERT INTO credit_card_invoices(user_id,connection_id,card_id,external_id,total,paid,due_date,closing_date,status) VALUES(p_user,cid,kid,x->>'id',(x->>'total')::numeric,(x->>'paid')::numeric,(x->>'due_date')::date,(x->>'closing_date')::date,x->>'status') ON CONFLICT(connection_id,external_id) DO UPDATE SET total=excluded.total,paid=excluded.paid,status=excluded.status,updated_at=now();
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'transactions') LOOP
 SELECT id INTO aid FROM financial_accounts WHERE connection_id=cid AND external_id=x->>'account_id';
 mid=NULL;
 SELECT id INTO mid FROM transactions WHERE user_id=p_user AND source='manual' AND kind=x->>'kind' AND amount=(x->>'amount')::numeric AND card_id IS NULL AND abs(extract(epoch FROM(date-(x->>'date')::timestamptz)))<=259200 AND (financial_account_id IS NULL OR financial_account_id=aid) AND (financial_institution_id IS NULL OR financial_institution_id=c.institution_id) ORDER BY abs(extract(epoch FROM(date-(x->>'date')::timestamptz))) LIMIT 1;
 INSERT INTO financial_transactions(user_id,connection_id,account_id,external_id,date,description,amount,kind,category,status,review_status,matched_transaction_id) VALUES(p_user,cid,aid,x->>'id',(x->>'date')::timestamptz,x->>'description',(x->>'amount')::numeric,x->>'kind',x->>'category',x->>'status',CASE WHEN mid IS NULL THEN 'accepted' ELSE 'possible_duplicate' END,mid) ON CONFLICT(connection_id,account_id,external_id) DO UPDATE SET amount=excluded.amount,status=excluded.status,category=CASE WHEN financial_transactions.manually_categorized THEN financial_transactions.category ELSE excluded.category END,updated_at=now();
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'card_transactions') LOOP
 SELECT id INTO kid FROM credit_cards WHERE connection_id=cid AND external_id=x->>'card_id'; SELECT id INTO iid FROM credit_card_invoices WHERE connection_id=cid AND external_id=x->>'invoice_id';
 mid=NULL; SELECT id INTO mid FROM transactions WHERE user_id=p_user AND source='manual' AND kind='despesa' AND card_id IS NOT NULL AND amount=(x->>'amount')::numeric AND abs(extract(epoch FROM(date-(x->>'date')::timestamptz)))<=259200 LIMIT 1;
 INSERT INTO credit_card_transactions(user_id,connection_id,card_id,invoice_id,external_id,date,description,amount,category,installments,installment_number,invoice_paid,review_status,matched_transaction_id) VALUES(p_user,cid,kid,iid,x->>'id',(x->>'date')::timestamptz,x->>'description',(x->>'amount')::numeric,x->>'category',(x->>'installments')::integer,(x->>'installment_number')::integer,false,CASE WHEN mid IS NULL THEN 'accepted' ELSE 'possible_duplicate' END,mid) ON CONFLICT(connection_id,card_id,external_id) DO UPDATE SET amount=excluded.amount,category=CASE WHEN credit_card_transactions.manually_categorized THEN credit_card_transactions.category ELSE excluded.category END,updated_at=now();
 END LOOP;
 UPDATE financial_connections SET last_sync_at=now(),updated_at=now() WHERE id=cid; INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,'sync_completed');
ELSIF p_action='disconnect' THEN
 UPDATE financial_connections SET status='disconnected',authorization_hash=NULL,authorization_expires_at=NULL,updated_at=now() WHERE id=cid;
 UPDATE open_finance_consents SET status='revoked',revoked_at=now(),updated_at=now() WHERE connection_id=cid AND status<>'revoked';
 UPDATE financial_accounts SET included=false WHERE connection_id=cid; UPDATE credit_cards SET included=false WHERE connection_id=cid;
 IF coalesce((p_data->>'remove_history')::boolean,false) THEN DELETE FROM financial_transactions WHERE connection_id=cid AND user_id=p_user; DELETE FROM credit_card_transactions WHERE connection_id=cid AND user_id=p_user; END IF;
 INSERT INTO sync_logs(user_id,connection_id,event) VALUES(p_user,cid,'connection_disconnected'),(p_user,cid,'consent_revoked');
ELSIF p_action='toggle' THEN
 IF c.status<>'active' OR c.expires_at<=now() THEN RAISE EXCEPTION 'consent_expired'; END IF;
 UPDATE financial_accounts SET included=(p_data->>'included')::boolean WHERE id=(p_data->>'resource_id')::uuid AND connection_id=cid AND user_id=p_user;
 UPDATE credit_cards SET included=(p_data->>'included')::boolean WHERE id=(p_data->>'resource_id')::uuid AND connection_id=cid AND user_id=p_user;
ELSIF p_action='resolve' THEN
 IF p_data->>'table'='financial_transactions' THEN UPDATE financial_transactions SET review_status=p_data->>'review_status',category=coalesce(p_data->>'category',category),manually_categorized=(p_data ? 'category') OR manually_categorized WHERE id=(p_data->>'resource_id')::uuid AND connection_id=cid AND user_id=p_user RETURNING matched_transaction_id INTO mid;
 ELSIF p_data->>'table'='credit_card_transactions' THEN UPDATE credit_card_transactions SET review_status=p_data->>'review_status',category=coalesce(p_data->>'category',category),manually_categorized=(p_data ? 'category') OR manually_categorized WHERE id=(p_data->>'resource_id')::uuid AND connection_id=cid AND user_id=p_user RETURNING matched_transaction_id INTO mid;
 ELSE RAISE EXCEPTION 'invalid_table'; END IF;
 IF coalesce((p_data->>'replace_manual')::boolean,false) AND p_data->>'review_status'='accepted' THEN UPDATE transactions SET reconciled_open_finance_id=(p_data->>'resource_id')::uuid WHERE id=mid AND user_id=p_user; END IF;
ELSIF p_action='expire' THEN
 UPDATE financial_connections SET status='expired',updated_at=now() WHERE id=cid AND status='active' AND expires_at<=now(); UPDATE open_finance_consents SET status='expired',updated_at=now() WHERE connection_id=cid AND status='active' AND expires_at<=now();
ELSIF p_action='error' THEN INSERT INTO sync_logs(user_id,connection_id,event,result) VALUES(p_user,cid,'sync_failed','provider_unavailable');
ELSIF p_action='delete' THEN DELETE FROM financial_connections WHERE id=cid AND user_id=p_user;
ELSE RAISE EXCEPTION 'invalid_action'; END IF;
RETURN jsonb_build_object('id',cid);
END $$;
REVOKE ALL ON FUNCTION public.of_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.of_command(uuid,text,jsonb) TO service_role;