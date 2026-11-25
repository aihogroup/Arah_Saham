-- Masukan untuk model ridge multivariat (setara tab Admin): persen perubahan harian tiap simbol pasar (komoditas, kurs, indeks global, proksi),
-- agregat broker, net asing, dan breadth, dikembalikan sebagai satu jsonb (menghindari batas 1000 baris PostgREST).
create or replace function public.ridge_mv_inputs()
returns jsonb language sql stable security definer set search_path = '' as $$
with ih as (
  select f.trade_date t, f.close::float8 c from public.fact_index_daily f where f.index_code = 'COMPOSITE' and f.trade_date >= '2020-01-01'),
sym as (select symbol, category from public.dim_market_symbol where active),
mv as (
  select ih.t, sym.symbol id,
    (select x.close::float8 from public.fact_market_daily x
      where x.symbol = sym.symbol and x.trade_date <= ih.t and x.trade_date > ih.t - 7 and coalesce(x.volume, 1) > 0
      order by x.trade_date desc limit 1) v
  from ih cross join sym),
ind as (select t, id, v, lag(v) over (partition by id order by t) pv from mv where v is not null),
pj as (
  select t, jsonb_object_agg('m_' || id, round(((v / pv - 1) * 100)::numeric, 4)) j from ind where pv is not null and pv <> 0 group by t),
bk as (
  select trade_date t, 100.0 * avg((value < pval)::int) filter (where pval is not null) bv, 100.0 * avg((frequency < pf)::int) filter (where pf is not null) bf
  from (select trade_date, value, frequency, lag(value) over w pval, lag(frequency) over w pf
        from public.fact_broker_daily window w as (partition by broker_code order by trade_date)) x group by trade_date),
mi as (select trade_date t, net_foreign_ratio nf, breadth_ratio br, target_date td from public.v_model_input),
rw as (
  select ih.t, ih.c, mi.td,
    coalesce(pj.j, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'b_value_down', round(bk.bv::numeric, 3), 'b_freq_down', round(bk.bf::numeric, 3),
      'b_foreign_net', round(mi.nf::numeric, 6), 'b_adv', round(mi.br::numeric, 6))) f
  from ih left join pj on pj.t = ih.t left join bk on bk.t = ih.t left join mi on mi.t = ih.t)
select jsonb_build_object(
  'rows', (select jsonb_agg(jsonb_build_object('date', t, 'close', c, 'td', td, 'f', f) order by t) from rw),
  'groups', (select jsonb_object_agg('m_' || symbol, category) from sym) || '{"b_value_down":"broker","b_freq_down":"broker","b_foreign_net":"broker","b_adv":"broker"}'::jsonb);
$$;
revoke all on function public.ridge_mv_inputs() from public, anon, authenticated;
grant execute on function public.ridge_mv_inputs() to service_role;

-- Keyakinan jujur = ketepatan nyata 120 ramalan terakhir yang hasilnya sudah diketahui (lantai 50%).
create or replace function public.finalize_ridge_mv(p_model text default 'ridge_mv')
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.evaluate_forecasts(p_model);
  with r as (
    select f.made_on, greatest(least(coalesce(avg(e.hit::int) over (order by f.made_on rows between 120 preceding and 1 preceding), 0.5), 0.95), 0.5) c
    from public.forecasts f left join public.evaluations e on e.model_id = f.model_id and e.made_on = f.made_on
    where f.model_id = p_model)
  update public.forecasts f set confidence = r.c from r where f.model_id = p_model and f.made_on = r.made_on and f.confidence is distinct from r.c;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.finalize_ridge_mv(text) from public, anon, authenticated;
grant execute on function public.finalize_ridge_mv(text) to service_role;

insert into public.model_versions (id, description, features, active)
values ('ridge_mv', 'Ridge multivariat setara Admin: 5 return IHSG terakhir + % perubahan semua simbol pasar + agregat broker, asing, breadth; standardisasi beku, pelatihan ulang tiap 21 hari, uji 1000 hari',
  array['lag1','lag2','lag3','lag4','lag5','m_*','b_value_down','b_freq_down','b_foreign_net','b_adv'], false)
on conflict (id) do nothing;
