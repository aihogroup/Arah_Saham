-- 0004: RLS, hak akses per peran, dan RPC pembaca
-- ===== aktifkan RLS =====
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke update on public.profiles from authenticated, anon;
grant update (username, birth_date, occupation, income_range, risk_tolerance, daily_loss_limit_pct, experience_years,
  trading_style, capital_range, active_hours, fav_indexes, fav_sectors, fav_indicators, consent_at) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;
-- tabel yang hanya boleh ditulis server (service_role) / fungsi definer
revoke insert, update, delete on public.subscriptions, public.orders, public.payment_events, public.user_roles, public.csv_downloads from authenticated;

-- pembaca publik (anon): referensi, komposisi, konten terbit
grant select on public.dim_stock, public.dim_broker, public.dim_index, public.dim_market_symbol, public.dim_date, public.plans,
  public.index_versions, public.index_members, public.index_changes, public.blog_posts, public.announcements to anon;

-- ===== kebijakan: referensi & konten (baca semua, tulis admin) =====
do $$ declare t text; begin
  foreach t in array array['dim_stock','dim_broker','dim_index','dim_market_symbol','dim_date','plans','index_versions','index_members','index_changes'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t || '_admin', t);
  end loop;
end $$;

create policy blog_read on public.blog_posts for select to anon, authenticated
  using (status = 'published' and publish_at <= now());
create policy blog_admin on public.blog_posts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ann_read on public.announcements for select to anon, authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy ann_admin on public.announcements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===== fakta (login: baca; admin: tulis) =====
do $$ declare t text; begin
  foreach t in array array['fact_stock_daily','fact_broker_daily','fact_index_daily','fact_market_daily','intraday_ihsg'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t || '_admin', t);
  end loop;
  -- skor & model (premium baca; admin baca/tulis lewat service)
  foreach t in array array['ind_catalog','feat_indicator_daily','feat_group_score','feat_breadth','feat_seasonality','stock_scores','stock_score_components','model_versions','model_fits','forecasts','evaluations'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_premium()))', t || '_premium', t);
  end loop;
  -- operasional: admin baca
  foreach t in array array['raw_ingest','ingest_log','quarantine','audit_log','payment_events','feat_indicator_state','feat_stock_state'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_admin()))', t || '_admin_read', t);
  end loop;
end $$;
create policy quarantine_admin_upd on public.quarantine for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===== akun =====
create policy profiles_self_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_self_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy presets_own on public.user_presets for all to authenticated using (user_id = (select auth.uid()) and (select public.is_premium()))
  with check (user_id = (select auth.uid()) and (select public.is_premium()));
create policy watch_own on public.watchlists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy subs_read on public.subscriptions for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy orders_read on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy csv_read on public.csv_downloads for select to authenticated using (user_id = (select auth.uid()));
-- preset boleh dibaca tetap oleh pemilik walau langganan habis
create policy presets_read_own on public.user_presets for select to authenticated using (user_id = (select auth.uid()));

-- ===== RPC publik / pembaca =====
create or replace function public.pub_data_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stock_date', (select max(trade_date) from public.fact_stock_daily),
    'index_date', (select max(trade_date) from public.fact_index_daily where index_code = 'COMPOSITE'),
    'broker_date', (select max(trade_date) from public.fact_broker_daily),
    'market_date', (select max(trade_date) from public.fact_market_daily),
    'scored_date', (select max(trade_date) from public.stock_scores),
    'complete', (select max(trade_date) from public.fact_stock_daily) = (select max(trade_date) from public.fact_index_daily where index_code = 'COMPOSITE')
                and (select max(trade_date) from public.fact_stock_daily) = (select max(trade_date) from public.fact_broker_daily),
    'demo', exists (select 1 from public.fact_index_daily where source = 'demo' and trade_date = (select max(trade_date) from public.fact_index_daily)));
$$;

create or replace function public.ihsg_series(p_days int default 30)
returns table (trade_date date, close numeric, change_pct numeric) language sql stable security definer set search_path = '' as $$
  select * from (
    select f.trade_date, f.close, f.change_pct from public.fact_index_daily f where f.index_code = 'COMPOSITE'
    order by f.trade_date desc
    limit case when (select auth.uid()) is null then least(greatest(p_days, 1), 31) else least(greatest(p_days, 1), 2000) end) x
  order by trade_date;
$$;

create or replace function public.market_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ihsg', (select jsonb_build_object('date', trade_date, 'close', close, 'change_pct', change_pct, 'prev_close', prev_close, 'value', value)
             from public.fact_index_daily where index_code = 'COMPOSITE' order by trade_date desc limit 1),
    'ihsg_spark', (select coalesce(jsonb_agg(close order by trade_date), '[]') from (select trade_date, close from public.fact_index_daily
             where index_code = 'COMPOSITE' order by trade_date desc limit 22) s),
    'breadth', (select to_jsonb(b) - 'net_foreign' from public.feat_breadth b order by trade_date desc limit 1),
    'others', (select coalesce(jsonb_agg(o order by o->>'category', o->>'symbol'), '[]') from (
        select jsonb_build_object('symbol', s.symbol, 'name', s.name, 'category', s.category, 'close', l.close, 'change_pct',
          round(((l.close / nullif(l.prev, 0) - 1) * 100)::numeric, 3),
          'spark', (select coalesce(jsonb_agg(c.close order by c.trade_date), '[]') from (select close, trade_date from public.fact_market_daily m
             where m.symbol = s.symbol order by m.trade_date desc limit 22) c)) as o
        from public.dim_market_symbol s
        cross join lateral (select (array_agg(z.close order by z.trade_date desc))[1] as close, (array_agg(z.close order by z.trade_date desc))[2] as prev
             from (select m.close, m.trade_date from public.fact_market_daily m where m.symbol = s.symbol order by m.trade_date desc limit 2) z) l
        where s.active and l.close is not null) q));
$$;

create or replace function public.rankings(p_kind text default 'gainer', p_limit int default 10, p_date date default null)
returns table (stock_code text, name text, sector text, close numeric, change_pct numeric, value numeric, volume bigint, net_foreign numeric, trade_date date, spark numeric[])
language plpgsql stable security definer set search_path = '' as $$
declare d date; lim int; anon boolean := (select auth.uid()) is null;
begin
  if p_kind not in ('gainer','loser','value','net_foreign') then raise exception 'Jenis peringkat tidak dikenal'; end if;
  lim := case when anon then least(greatest(p_limit,1), 10) else least(greatest(p_limit,1), 200) end;
  d := case when anon or p_date is null then (select max(f.trade_date) from public.fact_stock_daily f) else p_date end;
  return query
  select f.stock_code, s.name, s.sector, f.close, f.change_pct, f.value, f.volume, f.foreign_buy - f.foreign_sell, f.trade_date,
    (select array_agg(h.close order by h.trade_date) from (select x.close, x.trade_date from public.fact_stock_daily x
       where x.stock_code = f.stock_code and x.trade_date <= d order by x.trade_date desc limit 20) h)
  from public.fact_stock_daily f join public.dim_stock s on s.code = f.stock_code
  where f.trade_date = d
  order by (case p_kind when 'gainer' then f.change_pct when 'loser' then -f.change_pct when 'value' then f.value
                        else f.foreign_buy - f.foreign_sell end) desc nulls last, f.stock_code
  limit lim;
end $$;

create or replace function public.stock_table(p_index text default null, p_q text default null, p_limit int default 10, p_after text default null)
returns table (stock_code text, name text, sector text, close numeric, change_pct numeric, value numeric, trade_date date, spark numeric[])
language plpgsql stable security definer set search_path = '' as $$
declare d date := (select max(f.trade_date) from public.fact_stock_daily f); anon boolean := (select auth.uid()) is null; lim int;
begin
  lim := case when anon then least(greatest(p_limit,1), 10) else least(greatest(p_limit,1), 100) end;
  return query
  select s.code, s.name, s.sector, f.close, f.change_pct, f.value, f.trade_date,
    (select array_agg(h.close order by h.trade_date) from (select x.close, x.trade_date from public.fact_stock_daily x
       where x.stock_code = s.code and x.trade_date <= d order by x.trade_date desc limit 20) h)
  from public.dim_stock s join public.fact_stock_daily f on f.stock_code = s.code and f.trade_date = d
  where s.active
    and (p_index is null or p_index = 'ALL' or s.code in (select m.stock_code from public.index_members_on(p_index, d) m))
    and (p_q is null or s.code ilike p_q || '%' or s.name ilike '%' || p_q || '%')
    and (p_after is null or (not anon and s.code > p_after))
  order by case when anon then null else s.code end, f.value desc, s.code
  limit lim;
end $$;

create or replace function public.stock_series(p_code text, p_days int default 30)
returns table (trade_date date, close numeric, volume bigint, value numeric, change_pct numeric)
language sql stable security definer set search_path = '' as $$
  select * from (select f.trade_date, f.close, f.volume, f.value, f.change_pct from public.fact_stock_daily f where f.stock_code = upper(p_code)
    order by f.trade_date desc limit case when (select auth.uid()) is null then least(greatest(p_days,1), 31) else least(greatest(p_days,1), 2000) end) x
  order by trade_date;
$$;

create or replace function public.broker_share(p_date date default null, p_limit int default 100)
returns table (broker_code text, name text, value numeric, volume numeric, frequency bigint, share float8, trade_date date)
language plpgsql stable security definer set search_path = '' as $$
declare d date;
begin
  if (select auth.uid()) is null then raise exception 'Perlu login'; end if;
  d := coalesce(p_date, (select max(f.trade_date) from public.fact_broker_daily f));
  return query
  select f.broker_code, b.name, f.value, f.volume, f.frequency, (f.value / nullif(sum(f.value) over (), 0))::float8, f.trade_date
  from public.fact_broker_daily f join public.dim_broker b on b.code = f.broker_code where f.trade_date = d
  order by f.value desc limit least(greatest(p_limit,1), 200);
end $$;

-- kuota unduhan CSV per hari
create or replace function public.consume_csv_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); q int; used int;
begin
  if uid is null then return false; end if;
  q := case when public.is_premium() then 50 else 5 end;
  insert into public.csv_downloads (user_id, day, n) values (uid, current_date, 1)
  on conflict (user_id, day) do update set n = public.csv_downloads.n + 1 returning n into used;
  if used > q then
    update public.csv_downloads set n = q where user_id = uid and day = current_date;
    return false;
  end if;
  return true;
end $$;

-- ===== premium: kondisi pasar & Analisis Saya =====
create or replace function public.market_outlook() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return (select jsonb_build_object('made_on', made_on, 'target_date', target_date, 'direction', direction,
      'confidence', confidence, 'pred_return', pred_return, 'reasons', reasons)
    from public.forecasts where model_id = (select id from public.model_versions where active order by created_at desc limit 1)
    order by made_on desc limit 1);
end $$;

create or replace function public.analisis_saya(p_universe text[], p_indicators text[] default null, p_risk text default 'moderat')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d date; inds text[]; k int; mdir text; thr float8; topn int; res jsonb;
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  select max(trade_date) into d from public.stock_scores;
  if d is null then return jsonb_build_object('date', null, 'rows', '[]'::jsonb); end if;
  select array_agg(x) into inds from unnest(coalesce(p_indicators, '{}')) x where x in ('value','volume','frequency','net_foreign','mom');
  if inds is null then inds := array['value','volume','frequency','net_foreign','mom']; end if;
  k := cardinality(inds);
  select direction into mdir from public.forecasts order by made_on desc limit 1;
  thr := case p_risk when 'konservatif' then 0.90 when 'agresif' then 0.70 else 0.80 end;
  topn := case p_risk when 'konservatif' then 8 when 'agresif' then 12 else 10 end;
  with u as (
    select distinct stock_code from (
      select m.stock_code from unnest(coalesce(p_universe, '{}')) i cross join lateral public.index_members_on(i, d) m where i <> 'ALL'
      union all select code from public.dim_stock where active and 'ALL' = any(coalesce(p_universe, '{}'))) x),
  sc as (
    select u.stock_code, coalesce(sum(c.score) filter (where c.metric = any(inds)), 0) / k as score
    from u left join public.stock_score_components c on c.stock_code = u.stock_code and c.trade_date = d group by u.stock_code),
  pr as (select sc.*, percent_rank() over (order by score) as pct from sc),
  top as (select * from pr order by score desc, stock_code limit topn)
  select jsonb_build_object('date', d, 'market_direction', mdir, 'universe_size', (select count(*) from u), 'indicators', inds,
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'code', t.stock_code, 'name', s.name, 'sector', s.sector, 'score', round(t.score::numeric, 4), 'pct', round(t.pct::numeric, 3),
      'status', case
          when t.score > 0.02 and t.pct >= thr and (p_risk = 'agresif' or (p_risk = 'konservatif' and mdir = 'naik') or (p_risk = 'moderat' and mdir is distinct from 'turun')) then 'Pantau'
          when t.score < -0.02 and t.pct <= 1 - thr then 'Hindari' else 'Netral' end,
      'close', f.close, 'change_pct', f.change_pct,
      'indexes', (select coalesce(jsonb_agg(i.code order by i.sort_order), '[]') from public.dim_index i
                  where i.code <> 'COMPOSITE' and exists (select 1 from public.index_members_on(i.code, d) mm where mm.stock_code = t.stock_code)),
      'index_change', (select ch.change_type from public.index_changes ch where ch.stock_code = t.stock_code and not ch.superseded
                       and ch.effective_date > d - 45 and ch.effective_date <= d order by ch.effective_date desc limit 1),
      'reasons', (select coalesce(jsonb_agg(jsonb_build_object('metric', c.metric, 'score', round(c.score::numeric, 3))), '[]')
                  from (select * from public.stock_score_components c2 where c2.stock_code = t.stock_code and c2.trade_date = d
                        and c2.score <> 0 and c2.metric = any(inds) order by abs(c2.score) desc limit 3) c)
    ) order by t.score desc), '[]'))
  into res
  from top t join public.dim_stock s on s.code = t.stock_code
  left join public.fact_stock_daily f on f.stock_code = t.stock_code and f.trade_date = d;
  return res;
end $$;

-- hak eksekusi
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.is_premium(), public.pub_data_status(), public.ihsg_series(int), public.market_overview(),
  public.rankings(text, int, date), public.stock_table(text, text, int, text), public.stock_series(text, int),
  public.index_members_on(text, date) to anon, authenticated;
grant execute on function public.broker_share(date, int), public.consume_csv_quota(), public.market_outlook(),
  public.analisis_saya(text[], text[], text), public.accuracy_summary(int), public.start_trial(),
  public.preview_index_diff(text, text[], date), public.publish_index_version(text, date, text[], text) to authenticated;
grant execute on all functions in schema public to service_role;
