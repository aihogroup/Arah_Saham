-- Skor suara dinamis yang jujur (tanpa kebocoran data).
-- Untuk tiap indikator pasar (indeks global, komoditas, kurs, proksi) pada hari t:
--   skor = (rata-rata ketepatan arah 30 label TERAKHIR yang sudah diketahui sebelum t - 0,5) x bobot x arah hari t
--   bobot = |korelasi % ubah indikator vs % IHSG hari berikutnya| dari jendela 120/250/500 hari SEBELUM t,
--           disaring uji signifikansi (|t| >= 2), dinormalkan per kelompok, dirata-ratakan lintas jendela.
-- Seluruh jendela memakai "1 preceding" sehingga label hari t sendiri tidak pernah ikut terhitung.
create table if not exists public.feat_vote_daily (
  trade_date date not null, grp text not null, score float8 not null, n_active int not null default 0,
  primary key (trade_date, grp)
);
alter table public.feat_vote_daily enable row level security;

create or replace function public.refresh_vote_scores(p_from date default '2020-01-01')
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with ih as (select trade_date t, next_ret nr from public.v_ihsg_ret where trade_date >= p_from),
  sym as (select symbol, category grp from public.dim_market_symbol where active),
  mv as (
    select ih.t, ih.nr, sym.symbol id, sym.grp,
      (select x.close::float8 from public.fact_market_daily x
        where x.symbol = sym.symbol and x.trade_date <= ih.t and x.trade_date > ih.t - 7 and coalesce(x.volume, 1) > 0
        order by x.trade_date desc limit 1) v
    from ih cross join sym),
  ind as (select *, lag(v) over (partition by id order by t) pv from mv),
  d as (
    select *, sign(v - pv)::int dir, case when pv <> 0 then v / pv - 1 end pct,
      case when v <> pv and nr <> 0 then (sign(v - pv) = sign(nr))::int end lab
    from ind where v is not null),
  w as (
    select *,
      avg(lab) over (partition by id order by t rows between 30 preceding and 1 preceding) av,
      corr(pct, nr) over (partition by id order by t rows between 120 preceding and 1 preceding) r1,
      count(pct * nr) over (partition by id order by t rows between 120 preceding and 1 preceding) n1,
      corr(pct, nr) over (partition by id order by t rows between 250 preceding and 1 preceding) r2,
      count(pct * nr) over (partition by id order by t rows between 250 preceding and 1 preceding) n2,
      corr(pct, nr) over (partition by id order by t rows between 500 preceding and 1 preceding) r3,
      count(pct * nr) over (partition by id order by t rows between 500 preceding and 1 preceding) n3
    from d where pv is not null),
  ic as (
    select *,
      case when n1 > 30 and abs(r1) < 1 and abs(r1 * sqrt((n1 - 2) / (1 - r1 * r1))) >= 2 then abs(r1) else 0 end i1,
      case when n2 > 30 and abs(r2) < 1 and abs(r2 * sqrt((n2 - 2) / (1 - r2 * r2))) >= 2 then abs(r2) else 0 end i2,
      case when n3 > 30 and abs(r3) < 1 and abs(r3 * sqrt((n3 - 2) / (1 - r3 * r3))) >= 2 then abs(r3) else 0 end i3
    from w),
  nz as (
    select *, (coalesce(i1 / nullif(sum(i1) over (partition by grp, t), 0), 0) + coalesce(i2 / nullif(sum(i2) over (partition by grp, t), 0), 0)
             + coalesce(i3 / nullif(sum(i3) over (partition by grp, t), 0), 0)) / 3 wt from ic),
  s as (
    select t, grp, sum(coalesce((av - 0.5) * wt * dir, 0)) score, count(*) filter (where av is not null and wt > 0 and dir <> 0)::int na
    from nz group by t, grp),
  ins as (
    insert into public.feat_vote_daily (trade_date, grp, score, n_active)
    select t, grp, score, na from s
    on conflict (trade_date, grp) do update set score = excluded.score, n_active = excluded.n_active
    returning 1)
  select count(*) into n from ins;
  return n;
end $$;
revoke all on function public.refresh_vote_scores(date) from public, anon, authenticated;

-- Masukan model v2: fitur lama (tanpa broker) + skor suara jujur. Hanya untuk service role.
create or replace view public.v_model_input_v2 with (security_invoker = true) as
select m.trade_date,
  coalesce(max(v.score) filter (where v.grp = 'indeks_global'), 0) v_indeks_global,
  coalesce(max(v.score) filter (where v.grp = 'komoditas'), 0) v_komoditas,
  coalesce(max(v.score) filter (where v.grp = 'kurs'), 0) v_kurs,
  coalesce(max(v.score) filter (where v.grp = 'proksi_id'), 0) v_proksi_id,
  coalesce(max(v.score) filter (where v.grp = 'proksi_saham'), 0) v_proksi_saham,
  coalesce(sum(v.score), 0) v_total,
  max(m.g_broker_value) g_broker_value, max(m.g_broker_volume) g_broker_volume, max(m.g_broker_frequency) g_broker_frequency,
  max(m.g_komoditas) g_komoditas, max(m.g_kurs) g_kurs, max(m.g_indeks_global) g_indeks_global, max(m.g_proksi_id) g_proksi_id,
  max(m.breadth_ratio) breadth_ratio, max(m.pct_above_ma20) pct_above_ma20, max(m.net_foreign_ratio) net_foreign_ratio, max(m.value_up_log) value_up_log,
  max(m.seas_dow) seas_dow, max(m.seas_wom) seas_wom, max(m.seas_month) seas_month, max(m.seas_yearend) seas_yearend,
  max(m.mom1) mom1, max(m.mom5) mom5, max(m.mom20) mom20, max(m.target) target, max(m.target_date) target_date
from public.v_model_input m left join public.feat_vote_daily v on v.trade_date = m.trade_date
group by m.trade_date;
revoke all on public.v_model_input_v2 from public, anon, authenticated;
grant select on public.v_model_input_v2 to service_role;
grant select on public.feat_vote_daily to service_role;
