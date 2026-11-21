-- 0007: data nyata dari Yahoo Finance (saham IDX, IHSG, pasar global). IDX langsung diblokir Cloudflare dari cloud.
-- Simbol pasar tambahan sesuai koleksi Postman (Komoditas, Currency, Index Global).
insert into public.dim_market_symbol (symbol, name, category) values
 ('BZ=F','Minyak Brent','komoditas'),('HG=F','Tembaga','komoditas'),('ALI=F','Aluminium','komoditas'),('NG=F','Gas Alam','komoditas'),('SI=F','Perak','komoditas'),
 ('USDCNY=X','USD/CNY','kurs'),('USDSGD=X','USD/SGD','kurs'),('USDMYR=X','USD/MYR','kurs'),('USDJPY=X','USD/JPY','kurs'),('EURUSD=X','EUR/USD','kurs'),
 ('^DJI','Dow Jones','indeks_global'),('^KS11','KOSPI','indeks_global'),('PBCRY','BCA ADR (PBCRY)','proksi_id')
on conflict (symbol) do nothing;

-- Memanggil ingest saham Yahoo untuk semua saham aktif, 24 saham per panggilan.
create or replace function public.call_yahoo_stocks(p_days int default 7) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for r in
    select b, jsonb_agg(jsonb_build_object('code', code)) items from (
      select code, (row_number() over (order by code) - 1) / 24 as b from public.dim_stock where active) s group by b order by b
  loop
    perform public.call_pipeline('ingest', jsonb_build_object('source','yahoo_stocks','days_back',p_days,'to',today_wib,'items',r.items));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.call_yahoo_stocks(int) from public, anon, authenticated;

create or replace function public.enable_pipeline_cron() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Yahoo (UTC; WIB = UTC+7). Bursa tutup 16:00 WIB; ambil setelah 17:00 WIB.
  perform cron.schedule('yahoo-stocks', '15 10 * * 1-5', $c$select public.call_yahoo_stocks(7)$c$);
  perform cron.schedule('yahoo-index', '20 10 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo_index","days_back":10}')$c$);
  perform cron.schedule('yahoo-market', '25 10 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo","days_back":10}')$c$);
  perform cron.schedule('yahoo-market-am', '0 1 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"yahoo","days_back":10}')$c$);
  perform cron.schedule('intraday-5m', '*/5 2-9 * * 1-5', $c$select public.call_pipeline('ingest', '{"source":"intraday"}')$c$);
  perform cron.schedule('scoring', '0 12 * * 1-5', $c$select public.run_scoring(current_date - 10, current_date)$c$);
  perform cron.schedule('model', '30 12 * * 1-5', $c$select public.call_pipeline('run-model', '{}')$c$);
  perform cron.schedule('freshness', '45 12 * * 1-5', $c$select public.pipeline_freshness_check()$c$);
  perform cron.schedule('maintenance', '0 20 * * *', $c$select public.pipeline_maintenance()$c$);
end $$;

create or replace function public.disable_pipeline_cron() returns void
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  foreach n in array array['idx-wave1','idx-wave2','yahoo-0800','yahoo-0830','yahoo-evening','yahoo-stocks','yahoo-index','yahoo-market','yahoo-market-am','intraday-5m','freshness','scoring','model','maintenance'] loop
    begin perform cron.unschedule(n); exception when others then null; end;
  end loop;
end $$;
revoke execute on function public.enable_pipeline_cron(), public.disable_pipeline_cron() from public, anon, authenticated;
