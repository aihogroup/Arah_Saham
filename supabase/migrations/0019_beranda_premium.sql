-- Beranda premium: preferensi investasi, jurnal transaksi, dan rekomendasi personal.
-- Semua akses lewat RPC SECURITY DEFINER (search_path kosong) yang memeriksa is_premium().

create table if not exists public.user_invest_prefs (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  data_mode      text not null default 'stabil'  check (data_mode in ('stabil','dinamis')),
  universe_kind  text not null default 'indeks'  check (universe_kind in ('indeks','wishlist','semua')),
  indexes        text[] not null default array['LQ45'],
  buy_style      text not null default 'seimbang' check (buy_style in ('dip','momentum','seimbang')),
  criteria       text[] not null default array['value','volume','free_float'],
  lookback_days  int  not null default 21 check (lookback_days in (5,21,63)),
  hold_days      int  not null default 7  check (hold_days in (1,3,7,30)),
  max_picks      int  not null default 5  check (max_picks between 3 and 10),
  completed_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.user_invest_prefs enable row level security;
drop policy if exists prefs_own_select on public.user_invest_prefs;
create policy prefs_own_select on public.user_invest_prefs for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.user_trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stock_code  text not null references public.dim_stock(code),
  side        text not null check (side in ('buy','sell')),
  lots        int  not null check (lots between 1 and 10000000),
  price       numeric not null check (price > 0 and price < 100000000),
  traded_on   date not null default current_date check (traded_on <= current_date + 1),
  note        text check (char_length(note) <= 200),
  source      text not null default 'manual' check (source in ('manual','saldo_awal','rekomendasi')),
  created_at  timestamptz not null default now()
);
create index if not exists user_trades_user_idx on public.user_trades (user_id, traded_on desc, created_at desc);
create index if not exists user_trades_stock_idx on public.user_trades (stock_code);
alter table public.user_trades enable row level security;
drop policy if exists trades_own_select on public.user_trades;
create policy trades_own_select on public.user_trades for select to authenticated using (user_id = (select auth.uid()));

-- Posisi dengan metode harga rata-rata. 1 lot = 100 lembar. Tidak dapat dipanggil langsung oleh klien.
create or replace function public._positions(p_uid uuid)
returns table(stock_code text, lots numeric, avg_cost numeric, realized numeric, first_buy date, last_buy date)
language plpgsql stable security definer set search_path = '' as $$
declare r record; cur text := null; q numeric := 0; c numeric := 0; rl numeric := 0; fb date; lb date; a numeric; s numeric;
begin
  for r in select t.stock_code sc, t.side sd, t.lots l, t.price p, t.traded_on d
           from public.user_trades t where t.user_id = p_uid order by t.stock_code, t.traded_on, t.created_at loop
    if cur is distinct from r.sc then
      if cur is not null then stock_code := cur; lots := q; avg_cost := case when q > 0 then c / q end; realized := rl; first_buy := fb; last_buy := lb; return next; end if;
      cur := r.sc; q := 0; c := 0; rl := 0; fb := null; lb := null;
    end if;
    if r.sd = 'buy' then
      if q = 0 then fb := r.d; end if;
      q := q + r.l; c := c + r.l * r.p; lb := r.d;
    else
      s := least(r.l, q);
      if s > 0 then a := c / q; rl := rl + s * 100 * (r.p - a); c := c - s * a; q := q - s; end if;
    end if;
  end loop;
  if cur is not null then stock_code := cur; lots := q; avg_cost := case when q > 0 then c / q end; realized := rl; first_buy := fb; last_buy := lb; return next; end if;
end $$;
revoke all on function public._positions(uuid) from public, anon, authenticated;

create or replace function public.save_invest_prefs(p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); idx text[]; crit text[]; mode text; kind text; style text; lb int; hd int; mp int;
begin
  if uid is null or not public.is_premium() then raise exception 'Fitur premium'; end if;
  mode  := coalesce(p_data->>'data_mode', 'stabil');
  kind  := coalesce(p_data->>'universe_kind', 'indeks');
  style := coalesce(p_data->>'buy_style', 'seimbang');
  lb := coalesce((p_data->>'lookback_days')::int, 21);
  hd := coalesce((p_data->>'hold_days')::int, 7);
  mp := coalesce((p_data->>'max_picks')::int, 5);
  select coalesce(array_agg(distinct x), '{}') into idx from jsonb_array_elements_text(coalesce(p_data->'indexes', '[]')) x
    where x in (select code from public.dim_index where code <> 'COMPOSITE');
  select coalesce(array_agg(distinct x), '{}') into crit from jsonb_array_elements_text(coalesce(p_data->'criteria', '[]')) x
    where x in ('value','volume','freq_high','freq_low','foreign_buy','foreign_sell','gainer','loser','free_float');
  if kind = 'indeks' and cardinality(idx) = 0 then raise exception 'Pilih minimal satu indeks'; end if;
  if cardinality(crit) = 0 then crit := array['value','volume','free_float']; end if;
  insert into public.user_invest_prefs as p (user_id, data_mode, universe_kind, indexes, buy_style, criteria, lookback_days, hold_days, max_picks, completed_at, updated_at)
  values (uid, mode, kind, idx, style, crit, lb, hd, mp, now(), now())
  on conflict (user_id) do update set data_mode = excluded.data_mode, universe_kind = excluded.universe_kind, indexes = excluded.indexes,
    buy_style = excluded.buy_style, criteria = excluded.criteria, lookback_days = excluded.lookback_days, hold_days = excluded.hold_days,
    max_picks = excluded.max_picks, updated_at = now();
  update public.profiles set forecast_mode = mode where id = uid;
end $$;

create or replace function public.add_trade(p_code text, p_side text, p_lots int, p_price numeric, p_date date default current_date, p_note text default null, p_source text default 'manual')
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); have numeric;
begin
  if uid is null or not public.is_premium() then raise exception 'Fitur premium'; end if;
  if not exists (select 1 from public.dim_stock where code = upper(p_code)) then raise exception 'Kode saham tidak dikenal'; end if;
  if p_side = 'sell' then
    select coalesce(sum(lots), 0) into have from public._positions(uid) where stock_code = upper(p_code);
    if p_lots > have then raise exception 'Lot yang dijual melebihi kepemilikan tercatat (% lot)', have; end if;
  end if;
  if (select count(*) from public.user_trades where user_id = uid) >= 5000 then raise exception 'Batas catatan tercapai'; end if;
  insert into public.user_trades (user_id, stock_code, side, lots, price, traded_on, note, source)
  values (uid, upper(p_code), p_side, p_lots, p_price, coalesce(p_date, current_date), nullif(left(p_note, 200), ''), coalesce(p_source, 'manual'));
end $$;

create or replace function public.delete_trade(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_premium() then raise exception 'Fitur premium'; end if;
  delete from public.user_trades where id = p_id and user_id = auth.uid();
end $$;

create or replace function public.my_trades(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.traded_on desc, t.created_at desc) from (
    select id, stock_code, side, lots, price, traded_on, note, source from public.user_trades
    where user_id = auth.uid() order by traded_on desc, created_at desc limit least(greatest(p_limit, 1), 200)) t), '[]'::jsonb);
end $$;

create or replace function public.my_invest_prefs()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return (select to_jsonb(p) - 'user_id' from public.user_invest_prefs p where p.user_id = auth.uid());
end $$;

create or replace function public.premium_home()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); pr public.user_invest_prefs; d date; L int; outl jsonb; dir text; rscore int; risk text;
  crit text[]; k2 numeric; bonus numeric; stop_pct numeric; tp_pct numeric; picks jsonb; hold jsonb; realized_tot numeric; wl int := 0;
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  select * into pr from public.user_invest_prefs where user_id = uid;
  if not found then return jsonb_build_object('needs_setup', true); end if;
  select max(trade_date) into d from public.fact_stock_daily;
  L := pr.lookback_days; crit := pr.criteria;
  outl := public.market_outlook(); dir := coalesce(outl->>'direction', 'naik');
  select risk_score into rscore from public.profiles where id = uid;
  risk := case when rscore is null then 'moderat' when rscore <= 16 then 'konservatif' when rscore <= 24 then 'moderat' else 'agresif' end;
  stop_pct := case risk when 'konservatif' then 5 when 'agresif' then 12 else 8 end;
  tp_pct   := case risk when 'konservatif' then 6 when 'agresif' then 15 else 10 end;
  k2 := cardinality(crit) + case when pr.buy_style = 'seimbang' then 0 else 1 end;
  bonus := case when pr.hold_days <= 3 then 0.20 when pr.hold_days = 7 then 0.12 else 0.06 end;
  if pr.universe_kind = 'wishlist' then select count(*) into wl from public.watchlists where user_id = uid; end if;

  with days as (
    select trade_date from public.fact_index_daily where index_code = 'COMPOSITE' and trade_date <= d order by trade_date desc limit L),
  u as (
    select distinct sc from (
      select m.stock_code sc from unnest(pr.indexes) i cross join lateral public.index_members_on(i, d) m where pr.universe_kind = 'indeks'
      union all select w.stock_code from public.watchlists w where w.user_id = uid and pr.universe_kind = 'wishlist'
      union all select s.code from public.dim_stock s where s.active and pr.universe_kind = 'semua' and exists (select 1 from dwh.universe du where du.stock_code = s.code)) x),
  w as (
    select f.stock_code, sum(f.value) v, sum(f.volume) vol, avg(f.frequency) fq,
           sum(coalesce(f.foreign_buy, 0) - coalesce(f.foreign_sell, 0)) nf, count(*) nd,
           (array_agg(f.prev_close order by f.trade_date))[1] p0, (array_agg(f.close order by f.trade_date desc))[1] pl,
           (array_agg(f.change_pct order by f.trade_date desc))[1] chg
    from public.fact_stock_daily f
    where f.trade_date in (select trade_date from days) and f.stock_code in (select sc from u) group by 1),
  b as (
    select w.*, case when w.p0 > 0 then w.pl / w.p0 - 1 else 0 end ret, fl.free_float_pct ff, fl.pump_score, fl.risk_label
    from w left join dwh.mart_float_snapshot fl on fl.stock_code = w.stock_code
    where w.nd >= greatest(1, floor(L * 0.7))),
  r as (
    select b.*,
      percent_rank() over (order by coalesce(v, 0)) p_value,
      percent_rank() over (order by coalesce(vol, 0)) p_volume,
      percent_rank() over (order by coalesce(fq, 0)) p_freq,
      percent_rank() over (order by coalesce(nf, 0)) p_nf,
      percent_rank() over (order by ret) p_ret,
      percent_rank() over (order by coalesce(ff, 40)) p_ff
    from b),
  sc as (
    select r.*,
      (  (case when 'value' = any(crit) then p_value else 0 end)
       + (case when 'volume' = any(crit) then p_volume else 0 end)
       + (case when 'freq_high' = any(crit) then p_freq else 0 end)
       + (case when 'freq_low' = any(crit) then 1 - p_freq else 0 end)
       + (case when 'foreign_buy' = any(crit) then p_nf else 0 end)
       + (case when 'foreign_sell' = any(crit) then 1 - p_nf else 0 end)
       + (case when 'gainer' = any(crit) then p_ret else 0 end)
       + (case when 'loser' = any(crit) then 1 - p_ret else 0 end)
       + (case when 'free_float' = any(crit) then p_ff else 0 end)
       + (case pr.buy_style when 'dip' then (case when ret < -0.15 then 0.2 else 1 - p_ret end) when 'momentum' then p_ret else 0 end)) / k2 as score
    from r),
  fc as (
    select sc.*, sf.direction fdir, sf.confidence fconf,
           sc.score + case when sf.direction = 'naik' then bonus when sf.direction = 'turun' then -bonus else 0 end as adj
    from sc left join lateral (select direction, confidence from public.stock_forecasts x where x.stock_code = sc.stock_code order by made_on desc limit 1) sf on true
    where pr.universe_kind = 'wishlist' or risk = 'agresif' or coalesce(sc.pump_score, 0) < 60),
  top as (select * from fc order by adj desc, stock_code limit pr.max_picks)
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', t.stock_code, 'name', s.name, 'sector', s.sector, 'close', t.pl, 'change_pct', t.chg,
      'score', round(t.adj::numeric, 3), 'ret', round((t.ret * 100)::numeric, 2),
      'value', t.v, 'volume', t.vol, 'freq', round(t.fq::numeric), 'net_foreign', t.nf,
      'free_float', t.ff, 'pump', t.risk_label,
      'forecast', t.fdir, 'forecast_conf', t.fconf,
      'action', case when t.fdir is distinct from 'turun' and dir = 'naik' then 'Beli'
                     when dir = 'turun' and t.fdir = 'naik' and risk = 'agresif' then 'Beli kecil'
                     else 'Tunda' end,
      'why', (select coalesce(jsonb_agg(x.k), '[]'::jsonb) from (
                select k from (values ('value', t.p_value), ('volume', t.p_volume), ('freq_high', t.p_freq), ('freq_low', 1 - t.p_freq),
                                      ('foreign_buy', t.p_nf), ('foreign_sell', 1 - t.p_nf), ('gainer', t.p_ret), ('loser', 1 - t.p_ret), ('free_float', t.p_ff)) v(k, p)
                where k = any(crit) and p >= 0.6 order by p desc limit 3) x)
    ) order by t.adj desc), '[]'::jsonb)
  into picks
  from top t join public.dim_stock s on s.code = t.stock_code;

  with pos as (select * from public._positions(uid)),
  tot as (select coalesce(sum(p.lots * 100 * coalesce(f.close, p.avg_cost)), 0) total
          from pos p left join lateral (select close from public.fact_stock_daily x where x.stock_code = p.stock_code order by trade_date desc limit 1) f on true where p.lots > 0),
  h as (
    select p.stock_code, p.lots, p.avg_cost, p.first_buy, f.close, f.change_pct, sf.direction fdir, sf.confidence fconf, s.name, s.sector,
           case when p.avg_cost > 0 and f.close is not null then (f.close / p.avg_cost - 1) * 100 end pnl,
           case when (select total from tot) > 0 then p.lots * 100 * coalesce(f.close, p.avg_cost) / (select total from tot) * 100 end wt,
           (d - p.first_buy) days
    from pos p join public.dim_stock s on s.code = p.stock_code
    left join lateral (select close, change_pct from public.fact_stock_daily x where x.stock_code = p.stock_code order by trade_date desc limit 1) f on true
    left join lateral (select direction, confidence from public.stock_forecasts x where x.stock_code = p.stock_code order by made_on desc limit 1) sf on true
    where p.lots > 0)
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', h.stock_code, 'name', h.name, 'lots', h.lots, 'avg_cost', round(h.avg_cost, 2), 'close', h.close, 'change_pct', h.change_pct,
      'pnl_pct', round(h.pnl::numeric, 2), 'weight', round(h.wt::numeric, 1), 'days', h.days, 'forecast', h.fdir,
      'advice', case
          when h.pnl is not null and h.pnl <= -stop_pct then 'Evaluasi'
          when h.wt > 35 and (dir = 'turun' or h.fdir = 'turun') then 'Kurangi'
          when h.pnl is not null and h.pnl >= tp_pct and (h.fdir = 'turun' or dir = 'turun') then 'Ambil untung'
          when dir = 'turun' and h.fdir = 'turun' then 'Kurangi'
          when dir = 'naik' and h.fdir = 'naik' and coalesce(h.wt, 0) < 25 then 'Tambah'
          else 'Tahan' end,
      'reason', case
          when h.pnl is not null and h.pnl <= -stop_pct then 'Rugi sudah melewati batas ' || stop_pct || '% sesuai profil risiko Anda'
          when h.wt > 35 and (dir = 'turun' or h.fdir = 'turun') then 'Porsi ' || round(h.wt::numeric) || '% terlalu besar di tengah sinyal turun'
          when h.pnl is not null and h.pnl >= tp_pct and (h.fdir = 'turun' or dir = 'turun') then 'Untung sudah di atas ' || tp_pct || '% dan arah condong turun'
          when dir = 'turun' and h.fdir = 'turun' then 'Pasar dan saham ini sama-sama condong turun'
          when dir = 'naik' and h.fdir = 'naik' and coalesce(h.wt, 0) < 25 then 'Pasar dan saham ini condong naik, porsi masih wajar'
          when h.days is not null and h.days > pr.hold_days * 2 then 'Sudah melewati dua kali horizon ' || pr.hold_days || ' hari Anda, tinjau ulang'
          else 'Belum ada sinyal kuat untuk bertindak' end
    ) order by h.wt desc nulls last), '[]'::jsonb)
  into hold from h;

  select coalesce(sum(pp.realized), 0) into realized_tot from public._positions(uid) pp;

  return jsonb_build_object('date', d, 'outlook', outl, 'risk', risk, 'prefs', to_jsonb(pr) - 'user_id',
    'picks', picks, 'holdings', hold, 'realized', round(realized_tot), 'wishlist_count', wl, 'stop_pct', stop_pct, 'tp_pct', tp_pct);
end $$;

do $$ declare f text; begin
  foreach f in array array['save_invest_prefs(jsonb)','add_trade(text,text,int,numeric,date,text,text)','delete_trade(uuid)','my_trades(int)','my_invest_prefs()','premium_home()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
