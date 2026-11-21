-- 0003: mesin skoring walk-forward (satu aturan untuk semua kategori)
create or replace view public.v_ihsg_ret with (security_invoker = true) as
with r as (
  select trade_date, close::float8 as c, lag(close::float8) over w as pc, lag(trade_date) over w as pd, lead(trade_date) over w as nd
  from public.fact_index_daily where index_code = 'COMPOSITE' window w as (order by trade_date))
select trade_date, c as close, (c / nullif(pc,0) - 1) as ret, pd as prev_date, nd as next_date,
       lead(c / nullif(pc,0) - 1) over (order by trade_date) as next_ret
from r;

-- skor indikator tingkat pasar untuk satu hari (broker + komoditas/kurs/indeks global/proksi)
create or replace function public.score_market_day(p_date date) returns int
language plpgsql security definer set search_path = '' as $$
declare y smallint; r float8; cnt int;
begin
  select sign(ret)::smallint, ret into y, r from public.v_ihsg_ret where trade_date = p_date;
  if r is null then return 0; end if;

  insert into public.ind_catalog (indicator_id, grp, kind, entity, metric)
  select 'BRK:' || b.broker_code || ':' || m.metric, 'broker_' || m.metric, 'broker', b.broker_code, m.metric
  from (select distinct broker_code from public.fact_broker_daily where trade_date = p_date) b
  cross join (values ('value'),('volume'),('frequency')) m(metric)
  on conflict do nothing;
  insert into public.ind_catalog (indicator_id, grp, kind, entity, metric)
  select 'MKT:' || symbol, category, 'market', symbol, 'close' from public.dim_market_symbol where active
  on conflict do nothing;

  with brk as (
    select 'BRK:' || f.broker_code || ':' || m.metric as id, 'broker_' || m.metric as grp,
      (case m.metric when 'value' then f.value when 'volume' then f.volume else f.frequency::numeric end)::float8 as v
    from public.fact_broker_daily f cross join (values ('value'),('volume'),('frequency')) m(metric)
    where f.trade_date = p_date),
  brk2 as (select id, grp, v, v / nullif(sum(v) over (partition by grp), 0) as share from brk),
  mkt as (
    select 'MKT:' || s.symbol as id, s.category as grp, f.close::float8 as v, null::float8 as share
    from public.dim_market_symbol s
    cross join lateral (select x.close from public.fact_market_daily x
      where x.symbol = s.symbol and x.trade_date <= p_date and x.trade_date > p_date - 7 and coalesce(x.volume, 1) > 0
      order by x.trade_date desc limit 1) f
    where s.active),
  obs as (select * from brk2 union all select * from mkt),
  c as (
    select o.id, o.grp, o.v, o.share,
      coalesce(st.n,0) n, coalesce(st.s_sum,0) s_sum, coalesce(st.n0,0) n0, coalesce(st.s0_sum,0) s0_sum,
      coalesce(st.nc,0) nc, coalesce(st.sx,0) sx, coalesce(st.sy,0) sy, coalesce(st.sxx,0) sxx,
      coalesce(st.syy,0) syy, coalesce(st.sxy,0) sxy, coalesce(st.share_sum,0) share_sum, coalesce(st.share_n,0) share_n,
      st.last_val, st.last_dir, st.last_x
    from obs o left join public.feat_indicator_state st on st.indicator_id = o.id
    where st.last_date is null or st.last_date < p_date),
  d as (
    select c.*,
      case when last_val is null then 0 else sign(v - last_val)::int end as a,
      case when last_val is null or last_val = 0 then null else v / last_val - 1 end as x,
      (last_dir is not null and last_dir <> 0 and y <> 0) as lab
    from c),
  e as (
    select d.*,
      n + (case when lab then 1 else 0 end) as n1,
      s_sum + (case when lab and last_dir = y then 1 else 0 end) as s1,
      n0 + (case when a <> 0 and y <> 0 then 1 else 0 end) as n01,
      s0_sum + (case when a <> 0 and y <> 0 and a = y then 1 else 0 end) as s01,
      nc + (case when last_x is not null then 1 else 0 end) as nc1,
      sx + coalesce(last_x, 0) as sx1,
      sy + (case when last_x is not null then r else 0 end) as sy1,
      sxx + coalesce(last_x * last_x, 0) as sxx1,
      syy + (case when last_x is not null then r * r else 0 end) as syy1,
      sxy + coalesce(last_x * r, 0) as sxy1,
      share_sum + coalesce(share, 0) as ss1,
      share_n + (case when share is not null then 1 else 0 end) as sn1
    from d),
  f as (
    select e.*,
      (s1 + 0.5 * 20) / (n1 + 20.0) as p,
      case when n1 > 0 then (s1::float8 / n1 - 0.5) / sqrt(0.25 / n1) else 0 end as z,
      case when nc1 >= 5 and (nc1 * sxx1 - sx1 * sx1) > 0 and (nc1 * syy1 - sy1 * sy1) > 0
           then (nc1 * sxy1 - sx1 * sy1) / sqrt((nc1 * sxx1 - sx1 * sx1) * (nc1 * syy1 - sy1 * sy1)) else 0 end as corr
    from e),
  g as (
    select f.*, case when f.id like 'BRK:%' then coalesce(share, 0) * (ss1 / nullif(sn1, 0)) else abs(corr) end as m from f),
  h as (select g.*, m / nullif(sum(m) over (partition by grp), 0) as mn from g),
  h2 as (
    select h.*, a * (2 * p - 1) * coalesce(mn, 0) * (case when abs(z) >= 2 then 1 else 0 end) as score from h),
  ins as (
    insert into public.feat_indicator_daily (trade_date, indicator_id, direction, p, z, corr, mass, score)
    select p_date, id, a, p, z, corr, coalesce(mn, 0), score from h2 returning 1),
  grp as (
    insert into public.feat_group_score (trade_date, grp, score, n_active)
    select p_date, grp, sum(score), count(*) filter (where score <> 0) from h2 group by grp
    on conflict (trade_date, grp) do update set score = excluded.score, n_active = excluded.n_active returning 1),
  upd as (
    insert into public.feat_indicator_state (indicator_id, n, s_sum, n0, s0_sum, nc, sx, sy, sxx, syy, sxy, share_sum, share_n, last_val, last_dir, last_x, last_date)
    select id, n1, s1, n01, s01, nc1, sx1, sy1, sxx1, syy1, sxy1, ss1, sn1, v, a, x, p_date from h2
    on conflict (indicator_id) do update set n = excluded.n, s_sum = excluded.s_sum, n0 = excluded.n0, s0_sum = excluded.s0_sum,
      nc = excluded.nc, sx = excluded.sx, sy = excluded.sy, sxx = excluded.sxx, syy = excluded.syy, sxy = excluded.sxy,
      share_sum = excluded.share_sum, share_n = excluded.share_n, last_val = excluded.last_val, last_dir = excluded.last_dir,
      last_x = excluded.last_x, last_date = excluded.last_date returning 1)
  select count(*) into cnt from ins;
  return cnt;
end $$;

-- skor tingkat saham (5 indikator per saham, dinilai terhadap arah saham itu sendiri hari berikutnya)
create or replace function public.score_stocks_day(p_date date) returns int
language plpgsql security definer set search_path = '' as $$
declare cnt int;
begin
  with s as (
    select stock_code, coalesce(change_pct, 0)::float8 as chg, value::float8 as val, volume::float8 as vol,
           frequency::float8 as frq, (foreign_buy - foreign_sell)::float8 as nf
    from public.fact_stock_daily where trade_date = p_date and close > 0),
  m as (
    select stock_code, 'value' as metric, val as v, chg from s union all
    select stock_code, 'volume', vol, chg from s union all
    select stock_code, 'frequency', frq, chg from s union all
    select stock_code, 'net_foreign', nf, chg from s union all
    select stock_code, 'mom', chg, chg from s),
  c as (
    select m.*, coalesce(st.n,0) n, coalesce(st.s_sum,0) s_sum, st.last_val, st.last_dir
    from m left join public.feat_stock_state st on st.stock_code = m.stock_code and st.metric = m.metric
    where st.last_date is null or st.last_date < p_date),
  d as (
    select c.*, sign(chg)::int as y,
      case when metric = 'mom' then sign(v)::int when last_val is null then 0 else sign(v - last_val)::int end as a
    from c),
  e as (
    select d.*,
      n + (case when last_dir is not null and last_dir <> 0 and y <> 0 then 1 else 0 end) as n1,
      s_sum + (case when last_dir is not null and last_dir <> 0 and y <> 0 and last_dir = y then 1 else 0 end) as s1
    from d),
  f as (
    select e.*, (s1 + 10.0) / (n1 + 20.0) as p,
      case when n1 > 0 then (s1::float8 / n1 - 0.5) / sqrt(0.25 / n1) else 0 end as z
    from e),
  g as (select f.*, a * (2 * p - 1) * (case when abs(z) >= 2 then 1 else 0 end) as sc from f),
  comp as (
    insert into public.stock_score_components (trade_date, stock_code, metric, direction, p, z, score)
    select p_date, stock_code, metric, a, p, z, sc from g where a <> 0 returning 1),
  tot as (
    insert into public.stock_scores (trade_date, stock_code, score, n_active)
    select p_date, stock_code, sum(sc) / 5.0, count(*) filter (where sc <> 0) from g group by stock_code
    on conflict (stock_code, trade_date) do update set score = excluded.score, n_active = excluded.n_active returning 1),
  upd as (
    insert into public.feat_stock_state (stock_code, metric, n, s_sum, last_val, last_dir, last_date)
    select stock_code, metric, n1, s1, v, a, p_date from g
    on conflict (stock_code, metric) do update set n = excluded.n, s_sum = excluded.s_sum, last_val = excluded.last_val,
      last_dir = excluded.last_dir, last_date = excluded.last_date returning 1)
  select count(*) into cnt from tot;
  return cnt;
end $$;

create or replace function public.compute_breadth(p_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.feat_breadth (trade_date, advancers, decliners, unchanged, pct_above_ma20, net_foreign, value_up_ratio, total_value)
  with t as (select stock_code, change_pct, value, foreign_buy - foreign_sell as nf from public.fact_stock_daily where trade_date = p_date),
  ma as (
    select trade_date, close > avg(close) over (partition by stock_code order by trade_date rows between 19 preceding and current row) as above
    from public.fact_stock_daily where trade_date between p_date - 45 and p_date)
  select p_date,
    count(*) filter (where change_pct > 0), count(*) filter (where change_pct < 0), count(*) filter (where coalesce(change_pct,0) = 0),
    (select avg(above::int)::float8 from ma where trade_date = p_date),
    sum(nf), (sum(value) filter (where change_pct > 0))::float8 / nullif(sum(value) filter (where change_pct < 0), 0), sum(value)
  from t having count(*) > 0
  on conflict (trade_date) do update set advancers = excluded.advancers, decliners = excluded.decliners, unchanged = excluded.unchanged,
    pct_above_ma20 = excluded.pct_above_ma20, net_foreign = excluded.net_foreign, value_up_ratio = excluded.value_up_ratio, total_value = excluded.total_value;
end $$;

-- musiman diperhalus: rata-rata return historis (s.d. hari ini) untuk atribut kalender hari target, dibagi (n + 20)
create or replace function public.compute_seasonality(p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare tdate date; d public.dim_date%rowtype;
begin
  select min(date) into tdate from public.dim_date where date > p_date and is_trading_day;
  select * into d from public.dim_date where date = tdate;
  insert into public.feat_seasonality (trade_date, target_date, dow_avg, wom_avg, month_avg, yearend_avg)
  select p_date, tdate,
    coalesce(sum(r.ret) filter (where x.dow = d.dow) / (count(*) filter (where x.dow = d.dow) + 20), 0),
    coalesce(sum(r.ret) filter (where x.week_of_month = d.week_of_month) / (count(*) filter (where x.week_of_month = d.week_of_month) + 20), 0),
    coalesce(sum(r.ret) filter (where x.month = d.month) / (count(*) filter (where x.month = d.month) + 20), 0),
    coalesce(sum(r.ret) filter (where x.is_year_end = d.is_year_end) / (count(*) filter (where x.is_year_end = d.is_year_end) + 20), 0)
  from public.v_ihsg_ret r join public.dim_date x on x.date = r.trade_date
  where r.trade_date <= p_date and r.ret is not null
  on conflict (trade_date) do update set target_date = excluded.target_date, dow_avg = excluded.dow_avg,
    wom_avg = excluded.wom_avg, month_avg = excluded.month_avg, yearend_avg = excluded.yearend_avg;
end $$;

-- jalankan seluruh perhitungan harian untuk rentang tanggal (berurutan)
create or replace function public.run_scoring(p_from date, p_to date) returns int
language plpgsql security definer set search_path = '' as $$
declare d date; n int := 0;
begin
  for d in select trade_date from public.v_ihsg_ret where trade_date between p_from and p_to order by trade_date loop
    perform public.score_market_day(d);
    perform public.score_stocks_day(d);
    perform public.compute_breadth(d);
    perform public.compute_seasonality(d);
    n := n + 1;
  end loop;
  delete from public.stock_score_components where trade_date < current_date - 90;
  return n;
end $$;

create or replace function public.reset_scoring() returns void
language plpgsql security definer set search_path = '' as $$
begin
  truncate public.feat_indicator_daily, public.feat_group_score, public.feat_breadth, public.feat_seasonality,
           public.stock_scores, public.stock_score_components, public.feat_stock_state, public.feat_indicator_state;
end $$;

-- masukan model ridge: skor kelompok + breadth + musiman + momentum, target = return IHSG hari bursa berikutnya
create or replace view public.v_model_input with (security_invoker = true) as
with gs as (
  select trade_date,
    coalesce(max(score) filter (where grp = 'broker_value'), 0) as g_broker_value,
    coalesce(max(score) filter (where grp = 'broker_volume'), 0) as g_broker_volume,
    coalesce(max(score) filter (where grp = 'broker_frequency'), 0) as g_broker_frequency,
    coalesce(max(score) filter (where grp = 'komoditas'), 0) as g_komoditas,
    coalesce(max(score) filter (where grp = 'kurs'), 0) as g_kurs,
    coalesce(max(score) filter (where grp = 'indeks_global'), 0) as g_indeks_global,
    coalesce(max(score) filter (where grp = 'proksi_id'), 0) as g_proksi_id
  from public.feat_group_score group by trade_date),
mom as (
  select trade_date, ret as mom1, close / nullif(lag(close, 5) over (order by trade_date), 0) - 1 as mom5,
         close / nullif(lag(close, 20) over (order by trade_date), 0) - 1 as mom20, next_ret
  from public.v_ihsg_ret)
select m.trade_date, gs.g_broker_value, gs.g_broker_volume, gs.g_broker_frequency, gs.g_komoditas, gs.g_kurs, gs.g_indeks_global, gs.g_proksi_id,
  (b.advancers - b.decliners)::float8 / nullif(b.advancers + b.decliners + b.unchanged, 0) as breadth_ratio,
  b.pct_above_ma20, b.net_foreign::float8 / nullif(b.total_value, 0) as net_foreign_ratio,
  ln(greatest(least(coalesce(b.value_up_ratio, 1), 10), 0.1)) as value_up_log,
  s.dow_avg as seas_dow, s.wom_avg as seas_wom, s.month_avg as seas_month, s.yearend_avg as seas_yearend,
  m.mom1, m.mom5, m.mom20, m.next_ret as target, s.target_date
from mom m join gs on gs.trade_date = m.trade_date join public.feat_breadth b on b.trade_date = m.trade_date
join public.feat_seasonality s on s.trade_date = m.trade_date;

create or replace function public.evaluate_forecasts(p_model text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.evaluations (model_id, made_on, target_date, pred_return, actual_return, pred_dir, hit, baseline_up_hit)
  select f.model_id, f.made_on, r.trade_date, f.pred_return, r.ret, f.direction,
    case when f.direction = 'netral' then null else ((f.direction = 'naik') = (r.ret > 0)) end, (r.ret > 0)
  from public.forecasts f
  join public.v_ihsg_ret r0 on r0.trade_date = f.made_on
  join public.v_ihsg_ret r on r.trade_date = r0.next_date
  where f.model_id = p_model and r.ret is not null
  on conflict (model_id, made_on) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ringkasan akurasi walk-forward vs pembanding (premium)
create or replace function public.accuracy_summary(p_days int default 90)
returns table (n_total int, n_called int, n_neutral int, hit_rate float8, always_up_rate float8, random_rate float8)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return query
  with e as (select * from public.evaluations where made_on >= current_date - least(greatest(p_days, 1), 2000)
             and model_id = (select id from public.model_versions where active order by created_at desc limit 1))
  select count(*)::int, count(hit)::int, (count(*) - count(hit))::int,
    avg(hit::int)::float8, avg(baseline_up_hit::int) filter (where hit is not null)::float8, 0.5::float8 from e;
end $$;

revoke execute on function public.score_market_day(date), public.score_stocks_day(date), public.compute_breadth(date),
  public.compute_seasonality(date), public.run_scoring(date, date), public.reset_scoring(), public.evaluate_forecasts(text)
  from public, anon, authenticated;
