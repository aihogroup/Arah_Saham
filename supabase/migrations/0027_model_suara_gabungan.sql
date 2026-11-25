-- Model "suara_v1": arah = tanda skor suara jujur (feat_vote_daily); bila skor 0, arah dari sinyal ridge_v2 (tanpa intercept), lalu naik.
-- Besar ramalan dari ridge_v2. Keyakinan = ketepatan nyata model ini pada 120 ramalan terakhir yang hasilnya sudah diketahui
-- (dinamis dan jujur: jendela berhenti satu baris sebelum hari ramalan). Lantai 50%.
create or replace function public.build_suara_forecasts(p_from date default '2020-01-01')
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with b as (
    select f.made_on, f.target_date, f.pred_return pr, f.neutral_band, f.reasons r2, mf.intercept, v.v_total, v.v_indeks_global, v.v_komoditas, v.v_kurs, v.v_proksi_id, v.v_proksi_saham,
      r.next_ret nr
    from public.forecasts f
    join public.model_fits mf on mf.model_id = f.model_id and mf.fit_date = f.made_on
    join public.v_model_input_v2 v on v.trade_date = f.made_on
    join public.v_ihsg_ret r on r.trade_date = f.made_on
    where f.model_id = 'ridge_v2'),
  d as (
    select *, case when v_total <> 0 then sign(v_total)::int
                   when abs(pr - intercept) > 0 then sign(pr - intercept)::int else 1 end dr from b),
  h as (
    select *, case when nr is null or nr = 0 then null else ((dr > 0) = (nr > 0))::int end hit from d),
  c as (
    select *, coalesce(avg(hit) over (order by made_on rows between 120 preceding and 1 preceding), 0.5) rate from h),
  g as (
    select made_on, target_date, dr, abs(pr) mag, neutral_band, greatest(least(rate, 0.95), 0.5) conf, r2,
      (select coalesce(jsonb_agg(jsonb_build_object('feature', k, 'contribution', round(val::numeric, 6)) order by abs(val) desc), '[]'::jsonb)
       from (select k, val from (values ('v_indeks_global', c.v_indeks_global), ('v_komoditas', c.v_komoditas), ('v_kurs', c.v_kurs),
              ('v_proksi_id', c.v_proksi_id), ('v_proksi_saham', c.v_proksi_saham)) q(k, val) where val <> 0 order by abs(val) desc limit 3) t) rs
    from c where made_on >= p_from),
  ins as (
    insert into public.forecasts (model_id, made_on, target_date, pred_return, direction, confidence, neutral_band, reasons)
    select 'suara_v1', made_on, target_date, dr * mag, case when dr > 0 then 'naik' else 'turun' end, conf, neutral_band,
      case when jsonb_array_length(rs) > 0 then rs else r2 end
    from g
    on conflict (model_id, made_on) do update set target_date = excluded.target_date, pred_return = excluded.pred_return,
      direction = excluded.direction, confidence = excluded.confidence, neutral_band = excluded.neutral_band, reasons = excluded.reasons
    returning 1)
  select count(*) into n from ins;
  perform public.evaluate_forecasts('suara_v1');
  return n;
end $$;
revoke all on function public.build_suara_forecasts(date) from public, anon, authenticated;

insert into public.model_versions (id, description, features, active)
values ('suara_v1', 'Arah dari skor suara dinamis yang jujur (30 label terakhir, bobot korelasi 120/250/500 hari sebelum hari prediksi); keyakinan = ketepatan nyata 120 ramalan terakhir',
  array['v_indeks_global','v_komoditas','v_kurs','v_proksi_id','v_proksi_saham'], false)
on conflict (id) do nothing;
