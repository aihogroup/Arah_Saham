-- 0018b: gudang data (schema dwh) + prediksi per saham + analisis free float.
-- OLTP tetap di schema public; OLAP/fitur/mart di schema dwh (tidak terbuka bagi anon/authenticated).
create schema if not exists dwh;
revoke all on schema dwh from public, anon, authenticated;
grant usage on schema dwh to service_role;

-- ===== Dimensi / fakta =====
create table if not exists dwh.universe (
  stock_code text primary key references public.dim_stock(code) on delete cascade,
  avg_value_60d numeric not null, n_days int not null, refreshed_at timestamptz not null default now());

create table if not exists dwh.fact_stock_feature (
  stock_code text not null, trade_date date not null, close numeric,
  ret1 float8, ret5 float8, ret20 float8, vol20 float8,
  value_ratio float8, freq_ratio float8, foreign_ratio float8, range_pos float8, gap float8,
  adr_ret float8, etf_ret float8, usd_ret float8, ihsg_ret1 float8, ihsg_mom5 float8,
  g_broker_value float8, g_broker_volume float8, g_broker_frequency float8, g_komoditas float8, g_kurs float8,
  g_indeks_global float8, g_proksi_id float8, breadth_ratio float8, pct_above_ma20 float8, seas_dow float8, seas_month float8,
  next_date date, target float8, loaded_at timestamptz not null default now(),
  primary key (stock_code, trade_date));
create index if not exists fsf_date_idx on dwh.fact_stock_feature (trade_date);

create table if not exists dwh.mart_accuracy_month (
  stock_code text not null, ym date not null, n int not null, hits int not null,
  hit_rate float8, baseline_rate float8, mae float8, avg_conf float8, primary key (stock_code, ym));

create table if not exists dwh.mart_float_snapshot (
  stock_code text primary key, as_of date, close numeric, listed_shares bigint,
  free_float_pct numeric, float_known boolean not null default false,
  mcap numeric, float_mcap numeric, avg_value_20d numeric, turnover_float float8, vol20 float8,
  pump_score int, risk_label text, refreshed_at timestamptz not null default now());

-- ===== Tabel layanan (OLTP) =====
create table if not exists public.stock_forecasts (
  stock_code text not null, model_id text not null, made_on date not null, target_date date,
  pred_return float8, direction text, confidence float8, sigma float8, reasons jsonb,
  created_at timestamptz not null default now(), primary key (stock_code, model_id, made_on));
create table if not exists public.stock_evaluations (
  stock_code text not null, model_id text not null, made_on date not null, target_date date,
  pred_return float8, actual_return float8, pred_dir text, hit boolean, baseline_up_hit boolean,
  primary key (stock_code, model_id, made_on));
create index if not exists se_code_idx on public.stock_evaluations (stock_code, made_on desc);
alter table public.stock_forecasts enable row level security;
alter table public.stock_evaluations enable row level security;

-- ===== ETL =====
create or replace function dwh.refresh_universe(p_min_value numeric default 5e9, p_min_days int default 250)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with last as (select max(trade_date) d from public.fact_stock_daily),
  c as (
    select s.stock_code, count(*)::int n_days,
      avg(s.value) filter (where s.trade_date > (select d from last) - 90) avg_v,
      max(s.trade_date) last_d
    from public.fact_stock_daily s where s.trade_date >= date '2020-01-01' and s.close > 0 group by 1)
  insert into dwh.universe (stock_code, avg_value_60d, n_days, refreshed_at)
  select c.stock_code, c.avg_v, c.n_days, now() from c
  where c.avg_v >= p_min_value and c.n_days >= p_min_days and c.last_d = (select d from last)
    and exists (select 1 from public.dim_stock d where d.code = c.stock_code)
  on conflict (stock_code) do update set avg_value_60d = excluded.avg_value_60d, n_days = excluded.n_days, refreshed_at = now();
  get diagnostics n = row_count;
  delete from dwh.universe where refreshed_at < now();
  return n;
end $$;

create or replace function dwh.etl_stock_features(p_from date default current_date - 15, p_to date default 'infinity')
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with base as (
    select s.stock_code, s.trade_date, s.close, s.open_price, s.high, s.low, s.value, s.frequency, s.foreign_buy, s.foreign_sell,
      coalesce(nullif(s.prev_close, 0), lag(s.close) over w) as pc,
      lag(s.close, 5) over w as c5, lag(s.close, 20) over w as c20
    from public.fact_stock_daily s join dwh.universe u on u.stock_code = s.stock_code
    where s.trade_date >= p_from - 120 and s.close > 0
    window w as (partition by s.stock_code order by s.trade_date)
  ), r as (
    select b.*, (b.close / nullif(b.pc, 0) - 1)::float8 as ret1 from base b
  ), f as (
    select r.*,
      stddev_samp(r.ret1) over (partition by r.stock_code order by r.trade_date rows between 19 preceding and current row) as vol20,
      avg(r.value) over (partition by r.stock_code order by r.trade_date rows between 20 preceding and 1 preceding) as av20,
      avg(r.frequency) over (partition by r.stock_code order by r.trade_date rows between 20 preceding and 1 preceding) as af20,
      lead(r.trade_date) over (partition by r.stock_code order by r.trade_date) as next_date,
      lead(r.ret1) over (partition by r.stock_code order by r.trade_date) as target
    from r
  ), mk as (
    select m.symbol, m.trade_date,
      (m.close / nullif(lag(m.close) over (partition by m.symbol order by m.trade_date), 0) - 1)::float8 as ret,
      coalesce(lead(m.trade_date) over (partition by m.symbol order by m.trade_date), date 'infinity') as nxt
    from public.fact_market_daily m
    where m.trade_date >= p_from - 120
      and (m.symbol in ('EIDO', 'USDIDR=X') or m.symbol in (select symbol from public.stock_proxy where kind = 'adr'))
  ), vm as materialized (select * from public.v_model_input where trade_date >= p_from - 5),
  ins as (
    insert into dwh.fact_stock_feature as t (stock_code, trade_date, close, ret1, ret5, ret20, vol20, value_ratio, freq_ratio, foreign_ratio,
      range_pos, gap, adr_ret, etf_ret, usd_ret, ihsg_ret1, ihsg_mom5, g_broker_value, g_broker_volume, g_broker_frequency,
      g_komoditas, g_kurs, g_indeks_global, g_proksi_id, breadth_ratio, pct_above_ma20, seas_dow, seas_month, next_date, target, loaded_at)
    select f.stock_code, f.trade_date, f.close, f.ret1,
      (f.close / nullif(f.c5, 0) - 1)::float8, (f.close / nullif(f.c20, 0) - 1)::float8, f.vol20,
      ln(greatest(least(coalesce(f.value / nullif(f.av20, 0), 1), 10), 0.1))::float8,
      ln(greatest(least(coalesce(f.frequency / nullif(f.af20, 0), 1), 10), 0.1))::float8,
      ((f.foreign_buy - f.foreign_sell) / nullif(f.value, 0))::float8,
      case when f.high > f.low then ((f.close - f.low) / (f.high - f.low) - 0.5)::float8 end,
      (f.open_price / nullif(f.pc, 0) - 1)::float8,
      a.ret, e.ret, u.ret, vm.mom1, vm.mom5, vm.g_broker_value, vm.g_broker_volume, vm.g_broker_frequency,
      vm.g_komoditas, vm.g_kurs, vm.g_indeks_global, vm.g_proksi_id, vm.breadth_ratio, vm.pct_above_ma20, vm.seas_dow, vm.seas_month,
      coalesce(f.next_date, vm.target_date), f.target, now()
    from f
    left join public.stock_proxy sp on sp.stock_code = f.stock_code and sp.kind = 'adr'
    left join mk a on a.symbol = sp.symbol and f.trade_date > a.trade_date and f.trade_date <= a.nxt
    left join mk e on e.symbol = 'EIDO' and f.trade_date > e.trade_date and f.trade_date <= e.nxt
    left join mk u on u.symbol = 'USDIDR=X' and f.trade_date > u.trade_date and f.trade_date <= u.nxt
    left join vm on vm.trade_date = f.trade_date
    where f.trade_date >= p_from and f.trade_date <= p_to
    on conflict (stock_code, trade_date) do update set
      close = excluded.close, ret1 = excluded.ret1, ret5 = excluded.ret5, ret20 = excluded.ret20, vol20 = excluded.vol20,
      value_ratio = excluded.value_ratio, freq_ratio = excluded.freq_ratio, foreign_ratio = excluded.foreign_ratio,
      range_pos = excluded.range_pos, gap = excluded.gap, adr_ret = excluded.adr_ret, etf_ret = excluded.etf_ret, usd_ret = excluded.usd_ret,
      ihsg_ret1 = excluded.ihsg_ret1, ihsg_mom5 = excluded.ihsg_mom5, g_broker_value = excluded.g_broker_value,
      g_broker_volume = excluded.g_broker_volume, g_broker_frequency = excluded.g_broker_frequency, g_komoditas = excluded.g_komoditas,
      g_kurs = excluded.g_kurs, g_indeks_global = excluded.g_indeks_global, g_proksi_id = excluded.g_proksi_id,
      breadth_ratio = excluded.breadth_ratio, pct_above_ma20 = excluded.pct_above_ma20, seas_dow = excluded.seas_dow,
      seas_month = excluded.seas_month, next_date = excluded.next_date, target = excluded.target, loaded_at = now()
    returning 1)
  select count(*) into n from ins;
  return n;
end $$;

create or replace function dwh.refresh_float_snapshot()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with last as (select max(trade_date) d from public.fact_stock_daily),
  rk as (
    select s.stock_code, s.trade_date, s.close, s.listed_shares, s.value,
      case when s.prev_close > 0 then (s.close / s.prev_close - 1)::float8 end r,
      row_number() over (partition by s.stock_code order by s.trade_date desc) rn
    from public.fact_stock_daily s where s.trade_date > (select d from last) - 45 and s.close > 0),
  agg as (
    select stock_code, max(trade_date) last_d, max(close) filter (where rn = 1) close, max(listed_shares) filter (where rn = 1) ls,
      avg(value) filter (where rn <= 20) av, stddev_samp(r) filter (where rn <= 20) vol
    from rk group by 1),
  src as (
    select a.stock_code, a.last_d, a.close, coalesce(a.ls, d.listed_shares) ls, sf.free_float_pct ff, a.av, a.vol
    from agg a join public.dim_stock d on d.code = a.stock_code
    left join public.stock_float sf on sf.stock_code = a.stock_code
    where a.last_d = (select d from last)
      and (sf.stock_code is not null or exists (select 1 from dwh.universe u where u.stock_code = a.stock_code))),
  sc as (
    select s.*,
      round(case when s.ff is null then 20 else 40 * (1 - least(s.ff, 60) / 60) end
        + 25 * (1 - least(1, greatest(0, ln(greatest(coalesce(s.av, 0), 1e8) / 1e8) / ln(500))))
        + 20 * least(1, coalesce(s.vol, 0.03) / 0.06)
        + case when s.close <= 100 then 15 when s.close <= 500 then 8 else 0 end)::int as score
    from src s)
  insert into dwh.mart_float_snapshot (stock_code, as_of, close, listed_shares, free_float_pct, float_known, mcap, float_mcap, avg_value_20d,
      turnover_float, vol20, pump_score, risk_label, refreshed_at)
  select sc.stock_code, sc.last_d, sc.close, sc.ls, sc.ff, sc.ff is not null,
    sc.close * sc.ls, case when sc.ff is not null then sc.close * sc.ls * sc.ff / 100 end, sc.av,
    case when sc.ff is not null and sc.ls > 0 then (sc.av / nullif(sc.close * sc.ls * sc.ff / 100, 0))::float8 end,
    sc.vol, sc.score, case when sc.score >= 60 then 'tinggi' when sc.score >= 35 then 'sedang' else 'rendah' end, now()
  from sc
  on conflict (stock_code) do update set as_of = excluded.as_of, close = excluded.close, listed_shares = excluded.listed_shares,
    free_float_pct = excluded.free_float_pct, float_known = excluded.float_known, mcap = excluded.mcap, float_mcap = excluded.float_mcap,
    avg_value_20d = excluded.avg_value_20d, turnover_float = excluded.turnover_float, vol20 = excluded.vol20,
    pump_score = excluded.pump_score, risk_label = excluded.risk_label, refreshed_at = now();
  get diagnostics n = row_count;
  delete from dwh.mart_float_snapshot where refreshed_at < now();
  return n;
end $$;

create or replace function dwh.refresh_accuracy_mart()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into dwh.mart_accuracy_month (stock_code, ym, n, hits, hit_rate, baseline_rate, mae, avg_conf)
  select e.stock_code, date_trunc('month', e.made_on)::date, count(e.hit)::int, count(*) filter (where e.hit)::int,
    avg(e.hit::int)::float8, avg(e.baseline_up_hit::int)::float8, avg(abs(e.pred_return - e.actual_return)), avg(f.confidence)
  from public.stock_evaluations e
  left join public.stock_forecasts f on f.stock_code = e.stock_code and f.model_id = e.model_id and f.made_on = e.made_on
  group by 1, 2
  on conflict (stock_code, ym) do update set n = excluded.n, hits = excluded.hits, hit_rate = excluded.hit_rate,
    baseline_rate = excluded.baseline_rate, mae = excluded.mae, avg_conf = excluded.avg_conf;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.evaluate_stock_forecasts(p_model text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.stock_evaluations (stock_code, model_id, made_on, target_date, pred_return, actual_return, pred_dir, hit, baseline_up_hit)
  select f.stock_code, f.model_id, f.made_on, x.next_date, f.pred_return, x.target, f.direction,
    case when x.target = 0 then null else ((f.direction = 'naik') = (x.target > 0)) end, case when x.target = 0 then null else (x.target > 0) end
  from public.stock_forecasts f
  join dwh.fact_stock_feature x on x.stock_code = f.stock_code and x.trade_date = f.made_on
  where f.model_id = p_model and x.target is not null
  on conflict (stock_code, model_id, made_on) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Dijalankan cron (ETL harian) dan edge function (setelah model).
create or replace function public.run_stock_etl(p_from date default current_date - 15)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t0 timestamptz := clock_timestamp(); u int; f int; s int;
begin
  u := dwh.refresh_universe();
  f := dwh.etl_stock_features(p_from);
  s := dwh.refresh_float_snapshot();
  insert into public.ingest_log (source, trade_date, status, rows_in, rows_ok, duration_ms, message)
  values ('dwh_etl', current_date, 'ok', f, f, (extract(epoch from clock_timestamp() - t0) * 1000)::int, format('universe=%s fitur=%s float=%s', u, f, s));
  return jsonb_build_object('universe', u, 'features', f, 'float', s);
end $$;

create or replace function public.finish_stock_model(p_model text default 'ridge_stock_v1')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e int; m int;
begin
  e := public.evaluate_stock_forecasts(p_model);
  m := dwh.refresh_accuracy_mart();
  insert into public.ingest_log (source, trade_date, status, rows_in, rows_ok, message) values ('dwh_eval', current_date, 'ok', e, m, 'evaluasi saham + mart akurasi');
  return jsonb_build_object('evaluated', e, 'mart_rows', m);
end $$;

-- Antrian batch model per saham (edge function run-model-saham, tiap batch beberapa saham).
create or replace function public.run_stock_model(p_from date default current_date - 10, p_batch int default 6)
returns int language plpgsql security definer set search_path = '' as $$
declare total int; o int := 0;
begin
  select count(*) into total from dwh.universe;
  while o < total loop
    perform public.call_pipeline('run-model-saham', jsonb_build_object('offset', o, 'limit', p_batch, 'from', p_from));
    o := o + p_batch;
  end loop;
  return total;
end $$;

create or replace function public.model_stock_batch(p_offset int, p_limit int)
returns jsonb language sql security definer set search_path = '' set statement_timeout = '90s' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', u.stock_code,
    'cols', jsonb_build_array('ret1','ret5','ret20','vol20','value_ratio','freq_ratio','foreign_ratio','range_pos','gap','adr_ret','etf_ret','usd_ret','ihsg_ret1','ihsg_mom5',
            'g_broker_value','g_broker_volume','g_broker_frequency','g_komoditas','g_kurs','g_indeks_global','g_proksi_id','breadth_ratio','pct_above_ma20','seas_dow','seas_month'),
    'dates', a.dates, 'next', a.nx, 'y', a.ys, 'rows', a.rows)), '[]'::jsonb)
  from (select stock_code from dwh.universe order by stock_code offset p_offset limit p_limit) u
  cross join lateral (
    select jsonb_agg(x.trade_date order by x.trade_date) dates, jsonb_agg(x.next_date order by x.trade_date) nx, jsonb_agg(x.target order by x.trade_date) ys,
      jsonb_agg(jsonb_build_array(x.ret1, x.ret5, x.ret20, x.vol20, x.value_ratio, x.freq_ratio, x.foreign_ratio, x.range_pos, x.gap, x.adr_ret, x.etf_ret, x.usd_ret,
         x.ihsg_ret1, x.ihsg_mom5, x.g_broker_value, x.g_broker_volume, x.g_broker_frequency, x.g_komoditas, x.g_kurs, x.g_indeks_global, x.g_proksi_id,
         x.breadth_ratio, x.pct_above_ma20, x.seas_dow, x.seas_month) order by x.trade_date) rows
    from dwh.fact_stock_feature x where x.stock_code = u.stock_code and x.trade_date >= date '2022-06-01') a;
$$;

-- ===== RPC publik =====
create or replace function public.stock_float_list(p_sort text default 'score', p_limit int default 100, p_label text default null, p_only_known boolean default false)
returns table (stock_code text, name text, sector text, close numeric, free_float_pct numeric, float_known boolean, mcap numeric, float_mcap numeric,
  avg_value_20d numeric, turnover_float float8, vol20 float8, pump_score int, risk_label text, as_of date)
language sql stable security definer set search_path = '' as $$
  select m.stock_code, d.name, d.sector, m.close, m.free_float_pct, m.float_known, m.mcap, m.float_mcap, m.avg_value_20d, m.turnover_float, m.vol20,
    m.pump_score, m.risk_label, m.as_of
  from dwh.mart_float_snapshot m join public.dim_stock d on d.code = m.stock_code
  where (p_label is null or m.risk_label = p_label) and (not p_only_known or m.float_known)
  order by case p_sort when 'ff_asc' then m.free_float_pct end asc nulls last,
           case p_sort when 'ff_desc' then m.free_float_pct end desc nulls last,
           case p_sort when 'value' then m.avg_value_20d end desc nulls last,
           case when p_sort = 'score' or p_sort is null then m.pump_score end desc nulls last, m.stock_code
  limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.stock_float_detail(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(x) from (
    select m.stock_code, d.name, d.sector, m.close, m.listed_shares, m.free_float_pct, m.float_known, m.mcap, m.float_mcap,
      m.avg_value_20d, m.turnover_float, m.vol20, m.pump_score, m.risk_label, m.as_of, sf.source as float_source, sf.as_of as float_as_of
    from dwh.mart_float_snapshot m join public.dim_stock d on d.code = m.stock_code
    left join public.stock_float sf on sf.stock_code = m.stock_code
    where m.stock_code = upper(p_code)) x;
$$;

create or replace function public.stock_accuracy_history(p_code text, p_months int default 36)
returns table (ym date, n int, hits int, hit_rate float8, baseline_rate float8, mae float8, avg_conf float8)
language sql stable security definer set search_path = '' as $$
  select a.ym, a.n, a.hits, a.hit_rate, a.baseline_rate, a.mae, a.avg_conf from dwh.mart_accuracy_month a
  where a.stock_code = upper(p_code) order by a.ym desc limit least(greatest(p_months, 1), 120);
$$;

create or replace function public.stock_recent_evals(p_code text, p_limit int default 30)
returns table (made_on date, target_date date, pred_dir text, pred_return float8, actual_return float8, hit boolean)
language sql stable security definer set search_path = '' as $$
  select e.made_on, e.target_date, e.pred_dir, e.pred_return, e.actual_return, e.hit from public.stock_evaluations e
  where e.stock_code = upper(p_code) order by e.made_on desc limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.stock_forecast_latest(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c text := upper(p_code); prem boolean := public.is_premium(); fc jsonb;
begin
  if prem then
    select jsonb_build_object('made_on', f.made_on, 'target_date', f.target_date, 'direction', f.direction, 'confidence', f.confidence,
      'pred_return', f.pred_return, 'reasons', f.reasons) into fc
    from public.stock_forecasts f where f.stock_code = c order by f.made_on desc limit 1;
  end if;
  return jsonb_build_object('code', c, 'locked', not prem, 'forecast', fc,
    'accuracy', (select jsonb_build_object('n', count(hit), 'hit_rate', avg(hit::int), 'baseline_rate', avg(baseline_up_hit::int),
        'mae', avg(abs(pred_return - actual_return)), 'since', min(made_on)) from public.stock_evaluations where stock_code = c),
    'accuracy_90d', (select jsonb_build_object('n', count(hit), 'hit_rate', avg(hit::int), 'baseline_rate', avg(baseline_up_hit::int))
        from public.stock_evaluations where stock_code = c and made_on >= current_date - 90),
    'in_universe', exists (select 1 from dwh.universe where stock_code = c));
end $$;

create or replace function public.stock_accuracy_rank(p_min int default 150, p_limit int default 30)
returns table (stock_code text, name text, n int, hit_rate float8, baseline_rate float8, edge float8)
language sql stable security definer set search_path = '' as $$
  select e.stock_code, d.name, count(e.hit)::int, avg(e.hit::int)::float8, avg(e.baseline_up_hit::int)::float8, (avg(e.hit::int) - avg(e.baseline_up_hit::int))::float8
  from public.stock_evaluations e join public.dim_stock d on d.code = e.stock_code
  group by 1, 2 having count(e.hit) >= p_min order by 6 desc limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.stock_accuracy_tiers()
returns table (tier text, n bigint, hit_rate float8)
language sql stable security definer set search_path = '' set statement_timeout = '30s' as $
  select case when f.confidence >= 0.65 then '65+' when f.confidence >= 0.6 then '60-65' when f.confidence >= 0.55 then '55-60' else '<55' end t,
    count(e.hit), avg(e.hit::int)::float8
  from public.stock_evaluations e join public.stock_forecasts f using (stock_code, model_id, made_on)
  where e.hit is not null group by 1 order by 1 desc;
$;

-- ===== Hak akses =====
revoke all on function public.run_stock_etl(date), public.finish_stock_model(text), public.run_stock_model(date, int),
  public.model_stock_batch(int, int), public.evaluate_stock_forecasts(text) from public, anon, authenticated;
grant execute on function public.run_stock_etl(date), public.finish_stock_model(text), public.run_stock_model(date, int),
  public.model_stock_batch(int, int), public.evaluate_stock_forecasts(text) to service_role;
revoke all on function dwh.refresh_universe(numeric, int), dwh.etl_stock_features(date, date), dwh.refresh_float_snapshot(), dwh.refresh_accuracy_mart() from public, anon, authenticated;
grant execute on function public.stock_float_list(text, int, text, boolean), public.stock_float_detail(text), public.stock_accuracy_history(text, int),
  public.stock_recent_evals(text, int), public.stock_forecast_latest(text), public.stock_accuracy_rank(int, int), public.stock_accuracy_tiers() to anon, authenticated;
