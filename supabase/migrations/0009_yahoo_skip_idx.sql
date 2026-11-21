-- Yahoo hanya dipakai untuk saham yang belum punya data IDX; baris IDX (nilai & frekuensi asli) tidak boleh ditimpa estimasi Yahoo.
create or replace function public.call_yahoo_stocks(p_days int default 7) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for r in
    select b, jsonb_agg(jsonb_build_object('code', code)) items from (
      select code, (row_number() over (order by code) - 1) / 24 as b
      from public.dim_stock d
      where d.active and not exists (select 1 from public.fact_stock_daily f where f.stock_code = d.code and f.source = 'idx')) s
    group by b order by b
  loop
    perform public.call_pipeline('ingest', jsonb_build_object('source','yahoo_stocks','days_back',p_days,'to',today_wib,'items',r.items));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.call_yahoo_stocks(int) from public, anon, authenticated;
