-- 0005: rahasia pipeline (Vault), pg_cron + pg_net, pembersihan hak eksekusi fungsi pemicu
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'pipeline_secret', 'Rahasia pemanggil Edge Function pipeline')
where not exists (select 1 from vault.secrets where name = 'pipeline_secret');
select vault.create_secret('https://txjepqdmhccgggdrkuva.supabase.co', 'project_url', 'URL proyek Supabase')
where not exists (select 1 from vault.secrets where name = 'project_url');

create or replace function public.pipeline_secret_ok(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'pipeline_secret' and decrypted_secret = p);
$$;

create or replace function public.call_pipeline(p_fn text, p_body jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u text; s text; rid bigint;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'pipeline_secret';
  if u is null or s is null then return null; end if;
  select net.http_post(url := u || '/functions/v1/' || p_fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-secret', s),
    body := p_body, timeout_milliseconds := 120000) into rid;
  return rid;
end $$;

-- pembersihan retensi
create or replace function public.pipeline_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.intraday_ihsg where ts < now() - interval '10 days';
  delete from public.stock_score_components where trade_date < current_date - 90;
  delete from public.raw_ingest where fetched_at < now() - interval '120 days';
  delete from public.ingest_log where started_at < now() - interval '400 days';
end $$;

-- peringatan bila data hari ini kosong (dicek setelah gelombang 2)
create or replace function public.pipeline_freshness_check() returns void
language plpgsql security definer set search_path = '' as $$
declare lastd date; today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if extract(isodow from today_wib) >= 6 then return; end if;
  select max(trade_date) into lastd from public.fact_stock_daily;
  if lastd is null or lastd < today_wib then
    insert into public.announcements (message, level, starts_at, ends_at)
    select 'Data bursa hari ini belum lengkap. Skor ditahan sampai data tersedia.', 'warning', now(), now() + interval '20 hours'
    where not exists (select 1 from public.announcements where level = 'warning' and ends_at > now() and message like 'Data bursa hari ini belum%');
  end if;
end $$;

revoke execute on function public.pipeline_secret_ok(text), public.call_pipeline(text, jsonb), public.pipeline_maintenance(),
  public.pipeline_freshness_check(), public.handle_new_user(), public.audit_trigger(), public.touch_updated_at(), public.forbid_change()
  from public, anon, authenticated;
grant execute on function public.pipeline_secret_ok(text) to service_role;

-- jadwal (UTC; WIB = UTC+7). Tidak dijadwalkan otomatis: jalankan select public.enable_pipeline_cron(); setelah
-- data demo dihapus (select public.purge_demo();) dan backfill nyata selesai.
create or replace function public.enable_pipeline_cron() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('idx-wave1', '30 9 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"idx","datasets":["stock","index"],"days_back":5}')$c$);
  perform cron.schedule('idx-wave2', '30 11 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"idx","datasets":["broker"],"days_back":5}')$c$);
  perform cron.schedule('yahoo-0800', '0 1 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo","days_back":7}')$c$);
  perform cron.schedule('yahoo-0830', '30 1 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo","days_back":7}')$c$);
  perform cron.schedule('yahoo-evening', '0 12 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo","days_back":7}')$c$);
  perform cron.schedule('intraday-5m', '*/5 2-9 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"intraday"}')$c$);
  perform cron.schedule('freshness', '45 11 * * 1-5', $c$select public.pipeline_freshness_check()$c$);
  perform cron.schedule('scoring', '0 12 * * 1-5', $c$select public.run_scoring(current_date - 10, current_date)$c$);
  perform cron.schedule('model', '30 12 * * 1-5', $c$select public.call_pipeline('run-model', '{}')$c$);
  perform cron.schedule('maintenance', '0 20 * * *', $c$select public.pipeline_maintenance()$c$);
end $$;

create or replace function public.disable_pipeline_cron() returns void
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  foreach n in array array['idx-wave1','idx-wave2','yahoo-0800','yahoo-0830','yahoo-evening','intraday-5m','freshness','scoring','model','maintenance'] loop
    begin perform cron.unschedule(n); exception when others then null; end;
  end loop;
end $$;
revoke execute on function public.enable_pipeline_cron(), public.disable_pipeline_cron() from public, anon, authenticated;
