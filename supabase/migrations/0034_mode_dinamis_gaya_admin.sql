-- Mode DINAMIS = metode tab "Akurasi bobot IHSG" di Admin, persis (tanpa walk-forward):
--   skor indikator = (rata-rata 30 label terakhir SAMPAI hari itu - 0,5) x bobot x arah; bobot pasar = |korelasi| seluruh sejarah (disaring |t|>=2,
--   dinormalkan per kelompok); bobot broker = rata-rata porsi 30 hari (persen). Skor dijumlah, tandanya = ramalan.
-- PENTING: label hari yang dinilai ikut masuk ke rata-rata dan bobot memakai seluruh sejarah, jadi akurasi historisnya BERSIFAT IN-SAMPLE
-- (menunjukkan kecocokan pola dengan data, bukan akurasi ke depan). Ramalan hari terbaru tidak bocor karena hasilnya belum ada.
-- Mode STABIL tetap memakai model walk-forward yang dikunci (forecasts/evaluations).
create table if not exists public.dinamis_daily (
  made_on date primary key, target_date date, skor float8 not null, prediksi text not null check (prediksi in ('naik','turun')),
  actual_return float8, hit boolean, n_aktif int not null default 0, reasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.dinamis_daily enable row level security;
drop policy if exists dinamis_daily_premium on public.dinamis_daily;
create policy dinamis_daily_premium on public.dinamis_daily for select to authenticated using ((select public.is_premium()));
revoke all on public.dinamis_daily from anon, authenticated;
grant select on public.dinamis_daily to authenticated;

create or replace function public.refresh_dinamis()
returns integer language plpgsql security definer set search_path = '' as $
#variable_conflict use_column
declare n int;
begin
  with ih as (select v.trade_date t, v.next_ret nr, v.next_date nd from public.v_ihsg_ret v where v.trade_date >= '2020-01-01'),
  sym as (select symbol, category grp from public.dim_market_symbol where active),
  mv as (select ih.t, ih.nr, ih.nd, sym.symbol id, sym.grp,
     (select x.close::float8 from public.fact_market_daily x where x.symbol = sym.symbol and x.trade_date <= ih.t and x.trade_date > ih.t - 7 and coalesce(x.volume, 1) > 0 order by x.trade_date desc limit 1) v
     from ih cross join sym),
  ind as (select *, lag(v) over (partition by id order by t) pv from mv),
  d as (select t, nd, nr, id, grp, 'value'::text kind, sign(v - pv)::int dir, case when pv <> 0 then (v / pv - 1) * 100 end pct,
     case when v <> pv and nr <> 0 then (sign(v - pv) = sign(nr)) end ef from ind where v is not null and pv is not null),
  s as (select id, grp, count(*) n, corr(pct, nr) r from d where pct is not null and nr is not null and abs(pct) < 50 group by id, grp),
  w0 as (select *, case when n > 30 and r is not null and abs(r) < 1 and abs(r * sqrt((n - 2) / (1 - r * r))) >= 2 then abs(r) else 0 end ic from s),
  bw as (select id, round((coalesce(ic / nullif(sum(ic) over (partition by grp), 0), 0))::numeric, 4) bo from w0),
  bd as (select trade_date t, broker_code id, value::float8 value, volume::float8 volume, frequency::float8 frequency,
     lag(value::float8) over w pva, lag(volume::float8) over w pvo, lag(frequency::float8) over w pfr,
     sum(value::float8) over dt tv, sum(volume::float8) over dt tvo, sum(frequency::float8) over dt tf
     from public.fact_broker_daily window w as (partition by broker_code order by trade_date), dt as (partition by trade_date)),
  bk as (select b.t, k.kind, b.id, k.v - k.pv chg, round((100.0 * k.v / nullif(k.tot, 0))::numeric, 4)::float8 bob
     from bd b cross join lateral (values ('value', b.value, b.pva, b.tv), ('volume', b.volume, b.pvo, b.tvo), ('frequency', b.frequency, b.pfr, b.tf)) k(kind, v, pv, tot) where k.pv is not null),
  bs as (select bk.t, ih.nd, ih.nr, 'broker'::text grp, bk.kind, bk.id, sign(bk.chg)::int dir,
     case when ih.nr is null or ih.nr = 0 or bk.chg = 0 then null else (sign(bk.chg) = sign(ih.nr)) end ef, bk.bob
     from bk join ih on ih.t = bk.t),
  src as (
    select d.t, d.nd, d.nr, d.grp, d.kind, d.id, d.dir, d.ef, bw.bo bob, 0 isb from d left join bw using (id)
    union all select t, nd, nr, grp, kind, id, dir, ef, bob, 1 from bs),
  w as (select *, count(ef) over (partition by grp, kind, id order by t) rn from src),
  a as (select *,
     avg(case when ef then 1.0 when ef is not null then 0.0 end) over (partition by grp, kind, id order by rn range between 29 preceding and current row) av,
     case when isb = 1 then avg(bob) over (partition by grp, kind, id order by t rows between 29 preceding and current row) else bob end bo
     from w),
  sc as (select t, nd, nr, grp, kind, case when av is null or bo is null or dir is null then 0 else (av - 0.5) * bo * dir end x from a),
  tot as (select t, max(nd) nd, max(nr) nr, sum(x) st, (count(*) filter (where x <> 0))::int na from sc group by t),
  gk as (select t, case when grp = 'broker' then 'broker_' || kind else grp end k, sum(x) c from sc group by 1, 2),
  tp as (select t, k, c, row_number() over (partition by t order by abs(c) desc) r from gk where c <> 0),
  rj as (select t, jsonb_agg(jsonb_build_object('feature', case k when 'komoditas' then 'g_komoditas' when 'kurs' then 'g_kurs' when 'indeks_global' then 'g_indeks_global'
      when 'proksi_id' then 'g_proksi_id' when 'proksi_saham' then 'v_proksi_saham' when 'broker_value' then 'g_broker_value'
      when 'broker_volume' then 'g_broker_volume' else 'g_broker_frequency' end, 'contribution', round(c::numeric, 6)) order by r) rs
      from tp where r <= 3 group by t),
  ins as (
    insert into public.dinamis_daily (made_on, target_date, skor, prediksi, actual_return, hit, n_aktif, reasons, updated_at)
    select tot.t, coalesce(tot.nd, (select m.target_date from public.v_model_input m where m.trade_date = tot.t)), tot.st,
      case when tot.st >= 0 then 'naik' else 'turun' end, tot.nr,
      case when tot.nr is null or tot.nr = 0 or tot.st = 0 then null else (tot.st > 0) = (tot.nr > 0) end,
      tot.na, coalesce(rj.rs, '[]'::jsonb), now()
    from tot left join rj on rj.t = tot.t where tot.t >= '2021-01-01'
    on conflict (made_on) do update set target_date = excluded.target_date, skor = excluded.skor, prediksi = excluded.prediksi,
      actual_return = excluded.actual_return, hit = excluded.hit, n_aktif = excluded.n_aktif, reasons = excluded.reasons, updated_at = now()
    returning 1)
  select count(*) into n from ins;
  return n;
end $$;
revoke all on function public.refresh_dinamis() from public, anon, authenticated;

create or replace function public.dinamis_ringkasan(p_n integer default 1000)
returns table (n_called integer, hit_rate float8)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return query select count(*)::int, avg(t.hit::int)::float8
    from (select hit from public.dinamis_daily where hit is not null order by made_on desc limit least(greatest(p_n, 1), 5000)) t;
end $$;
revoke all on function public.dinamis_ringkasan(integer) from public, anon;
grant execute on function public.dinamis_ringkasan(integer) to authenticated;

create or replace function public.dinamis_per_tahun()
returns table (yr int, n_called integer, hit_rate float8, up_share float8)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return query select extract(year from made_on)::int, count(hit)::int, avg(hit::int)::float8, avg((prediksi = 'naik')::int)::float8
    from public.dinamis_daily where hit is not null group by 1 order by 1 desc;
end $$;
revoke all on function public.dinamis_per_tahun() from public, anon;
grant execute on function public.dinamis_per_tahun() to authenticated;

-- Ramalan live mode dinamis: baris terbaru (hasilnya belum ada). Keyakinan memakai angka model stabil yang jujur (bukan akurasi in-sample).
create or replace function public.outlook_dinamis_admin()
returns jsonb language sql stable security definer set search_path = '' as $$
  with l as (select * from public.dinamis_daily order by made_on desc limit 1),
  f as (select confidence, pred_return from public.forecasts where model_id = (select id from public.model_versions where active order by created_at desc limit 1) order by made_on desc limit 1)
  select jsonb_build_object('made_on', l.made_on, 'target_date', l.target_date, 'direction', l.prediksi,
    'confidence', coalesce((select confidence from f), 0.5),
    'pred_return', (case when l.prediksi = 'naik' then 1 else -1 end) * abs(coalesce((select pred_return from f), 0)),
    'reasons', l.reasons, 'metode', 'admin', 'computed_at', l.updated_at)
  from l
$$;
revoke all on function public.outlook_dinamis_admin() from public, anon, authenticated;

create or replace function public.market_outlook()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m text; snap jsonb; dyn jsonb;
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  select forecast_mode into m from public.profiles where id = auth.uid();
  snap := (select jsonb_build_object('made_on', made_on, 'target_date', target_date, 'direction', direction,
      'confidence', confidence, 'pred_return', pred_return, 'reasons', reasons)
    from public.forecasts where model_id = (select id from public.model_versions where active order by created_at desc limit 1)
    order by made_on desc limit 1);
  if coalesce(m, 'stabil') = 'dinamis' then
    dyn := public.outlook_dinamis_admin();
    if dyn is not null then
      return dyn || jsonb_build_object('mode', 'dinamis', 'snapshot_direction', snap -> 'direction', 'snapshot_confidence', snap -> 'confidence');
    end if;
  end if;
  if snap is null then return null; end if;
  return snap || jsonb_build_object('mode', 'stabil');
end $$;

select cron.schedule('dinamis-admin', '38 12 * * 1-5', 'select public.refresh_dinamis()');
