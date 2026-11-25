-- Peringkat saham untuk satu hari atau rentang tanggal, dengan 11 metrik dan filter papan/sektor/indeks.
-- Semua dihitung saat diminta dari fact_stock_daily; tidak ada tabel peringkat yang disimpan.
-- Pengunjung (anon): hanya hari bursa terakhir, maksimal 10 baris. Akun masuk: rentang sampai 400 hari, maksimal 200 baris.
create or replace function public.rank_stocks(
  p_metric text default 'gainer', p_from date default null, p_to date default null,
  p_board text default null, p_sector text default null, p_index text default null, p_limit int default 10)
returns table(stock_code text, name text, sector text, board text, close numeric, change_pct numeric, value numeric, volume numeric,
  frequency numeric, foreign_buy numeric, foreign_sell numeric, net_foreign numeric, free_float_pct numeric,
  days int, from_date date, to_date date, spark numeric[])
language plpgsql stable security definer set search_path = '' as $$
declare anon boolean := (select auth.uid()) is null; lim int; latest date; f date; t date; d1 date; d2 date; sw date;
begin
  if p_metric not in ('gainer','loser','value','volume','frequency','foreign_buy','foreign_sell','net_foreign_buy','net_foreign_sell','free_float','free_float_low') then
    raise exception 'Jenis peringkat tidak dikenal';
  end if;
  lim := case when anon then least(greatest(p_limit, 1), 10) else least(greatest(p_limit, 1), 200) end;
  select max(x.trade_date) into latest from public.fact_stock_daily x;
  if anon or (p_from is null and p_to is null) then f := latest; t := latest;
  else
    f := coalesce(p_from, p_to); t := least(coalesce(p_to, p_from), latest);
    if f > t then sw := f; f := t; t := least(sw, latest); end if;
    f := greatest(f, t - 400);
  end if;
  select min(x.trade_date), max(x.trade_date) into d1, d2 from public.fact_stock_daily x where x.trade_date between f and t;
  if d1 is null then return; end if;
  return query
  with a as (
    select x.stock_code sc, sum(x.value) v, sum(x.volume)::numeric vo, sum(x.frequency)::numeric fr, sum(x.foreign_buy) fb, sum(x.foreign_sell) fs,
           (array_agg(x.close order by x.trade_date desc))[1] lc,
           (array_agg(coalesce(nullif(x.prev_close, 0), x.close) order by x.trade_date))[1] base, count(*)::int n
    from public.fact_stock_daily x where x.trade_date between d1 and d2 group by x.stock_code having sum(x.volume) > 0),
  b as (
    select a.sc, a.v, a.vo, a.fr, a.fb, a.fs, a.lc, a.n, s.name nm, s.sector sec, s.board bd, ff.free_float_pct ffp,
           case when a.base > 0 then (a.lc / a.base - 1) * 100 end chg
    from a join public.dim_stock s on s.code = a.sc
    left join dwh.mart_float_snapshot ff on ff.stock_code = a.sc and ff.float_known
    where s.active
      and (p_board is null or s.board is not distinct from p_board)
      and (p_sector is null or s.sector is not distinct from p_sector)
      and (p_index is null or a.sc in (select m.stock_code from public.index_members_on(p_index, d2) m)))
  select b.sc, b.nm, b.sec, b.bd, b.lc, round(b.chg, 2), b.v, b.vo, b.fr, b.fb, b.fs, b.fb - b.fs, b.ffp, b.n, d1, d2,
    (select array_agg(h.close order by h.trade_date) from (select y.close, y.trade_date from public.fact_stock_daily y
       where y.stock_code = b.sc and y.trade_date <= d2 order by y.trade_date desc limit 20) h)
  from b
  where (p_metric not in ('free_float', 'free_float_low') or b.ffp is not null)
  order by (case p_metric
      when 'gainer' then b.chg when 'loser' then -b.chg when 'value' then b.v when 'volume' then b.vo when 'frequency' then b.fr
      when 'foreign_buy' then b.fb when 'foreign_sell' then b.fs when 'net_foreign_buy' then b.fb - b.fs when 'net_foreign_sell' then b.fs - b.fb
      when 'free_float' then b.ffp when 'free_float_low' then -b.ffp end) desc nulls last, b.sc
  limit lim;
end $$;
grant execute on function public.rank_stocks(text, date, date, text, text, text, int) to anon, authenticated;
