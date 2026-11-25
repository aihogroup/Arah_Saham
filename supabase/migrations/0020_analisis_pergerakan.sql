-- Analisis pergerakan: hubungan historis tiap instrumen pasar (kurs, komoditas, indeks global, proksi, ETF/ADR)
-- dengan IHSG hari berikutnya, plus ringkasan aktivitas broker. Data publik (agregat), aman untuk anon.
create or replace function public.movement_analysis()
returns jsonb language sql stable security definer set search_path = '' as $$
with ih as (
  select trade_date t, change_pct / 100.0 r from public.fact_index_daily
  where index_code = 'COMPOSITE' and change_pct is not null order by trade_date desc limit 250),
sym as (
  select symbol, name, category from public.dim_market_symbol
  where active and category in ('komoditas','kurs','indeks_global','proksi_id','proksi_saham')),
ret as (
  select f.symbol, f.trade_date d, f.close,
         f.close / nullif(lag(f.close) over w, 0) - 1 r,
         f.close / nullif(lag(f.close, 5) over w, 0) - 1 r5,
         lead(f.trade_date) over w nd
  from public.fact_market_daily f join sym s on s.symbol = f.symbol
  where f.trade_date > current_date - 420
  window w as (partition by f.symbol order by f.trade_date)),
pair as (
  select r.symbol, r.r sr, i.r ir
  from ret r cross join lateral (select t, ih.r from ih where t > r.d order by t limit 1) i
  where r.r is not null and (r.nd is null or i.t <= r.nd)),
st as (select symbol, corr(sr, ir) c, stddev(sr) sd, count(*) n from pair group by 1 having count(*) >= 60),
last as (select distinct on (symbol) symbol, d, close, r, r5 from ret where r is not null order by symbol, d desc),
items as (
  select s.category, s.symbol, s.name, l.d, l.close, l.r, l.r5, st.c, st.n,
         st.c * l.r / nullif(st.sd, 0) z
  from sym s join last l on l.symbol = s.symbol join st on st.symbol = s.symbol where st.c is not null),
cats as (
  select category,
    jsonb_build_object(
      'direction', case when coalesce(sum(z), 0) >= 0 then 'naik' else 'turun' end,
      'supporting', count(*) filter (where z >= 0), 'total', count(*),
      'items', jsonb_agg(jsonb_build_object(
        'symbol', symbol, 'name', name, 'date', d, 'close', close, 'chg_1d', round((r * 100)::numeric, 2), 'chg_5d', round((r5 * 100)::numeric, 2),
        'corr', round(c::numeric, 2), 'n', n,
        'signal', case when z >= 0 then 'naik' else 'turun' end,
        'strength', case when abs(c) >= 0.3 then 'kuat' when abs(c) >= 0.15 then 'sedang' else 'lemah' end
      ) order by abs(z) desc nulls last)) j
  from items group by category),
bd as (select max(trade_date) d from public.fact_broker_daily),
bt as (
  select f.broker_code, f.value v,
         (select avg(x.value) from public.fact_broker_daily x where x.broker_code = f.broker_code and x.trade_date < f.trade_date and x.trade_date >= f.trade_date - 30) a20
  from public.fact_broker_daily f where f.trade_date = (select d from bd)),
bs as (select sum(v) tot, sum(a20) atot from bt),
btop as (
  select b.broker_code, d.name, b.v, b.a20, b.v / nullif((select tot from bs), 0) * 100 share
  from bt b left join public.dim_broker d on d.code = b.broker_code order by b.v desc limit 8),
brk as (
  select jsonb_build_object('date', (select d from bd), 'total', (select tot from bs), 'avg', (select atot from bs),
    'ratio', round(((select tot from bs) / nullif((select atot from bs), 0))::numeric, 2),
    'top5_share', (select round(sum(share)::numeric, 1) from (select share from btop order by v desc limit 5) q),
    'top', (select jsonb_agg(jsonb_build_object('code', broker_code, 'name', name, 'value', v, 'share', round(share::numeric, 1),
              'ratio', round((v / nullif(a20, 0))::numeric, 2)) order by v desc) from btop)) j)
select jsonb_build_object(
  'ihsg', (select jsonb_build_object('date', t, 'chg', round((r * 100)::numeric, 2)) from ih order by t desc limit 1),
  'groups', (select jsonb_object_agg(category, j) from cats),
  'broker', (select j from brk));
$$;
grant execute on function public.movement_analysis() to anon, authenticated;
