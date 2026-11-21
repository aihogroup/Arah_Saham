-- Mode ramalan untuk pengguna Premium:
--   stabil  = ramalan beku yang dihitung sekali per hari bursa (tabel forecasts, tak bisa diubah)
--   dinamis = ramalan dihitung ulang tiap dibuka dari baris masukan TERBARU dan model terlatih terakhir
alter table public.profiles add column if not exists forecast_mode text not null default 'stabil'
  check (forecast_mode in ('stabil', 'dinamis'));

create or replace function public.norm_cdf(x double precision) returns double precision
language sql immutable parallel safe as $$
  select case when x > 0 then 1 - p else p end
  from (select 0.3989423 * exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))) p
        from (select 1 / (1 + 0.2316419 * abs(x)) t) a) b
$$;

create or replace function public.set_forecast_mode(p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Perlu masuk'; end if;
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  if p_mode not in ('stabil', 'dinamis') then raise exception 'Mode tidak dikenal'; end if;
  update public.profiles set forecast_mode = p_mode where id = auth.uid();
end $$;

create or replace function public.outlook_dinamis() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mdl as (select id from public.model_versions where active order by created_at desc limit 1),
  x as (select to_jsonb(v) j from public.v_model_input v order by trade_date desc limit 1),
  f as (select mf.* from public.model_fits mf where mf.model_id = (select id from mdl) order by mf.fit_date desc limit 1),
  sg as (select neutral_band from public.forecasts where model_id = (select id from mdl) order by made_on desc limit 1),
  c as (
    select k, (f.coefs ->> k)::float8 * (coalesce((x.j ->> k)::float8, 0) - (f.means ->> k)::float8)
              / greatest((f.stds ->> k)::float8, 1e-6) contrib
    from x, f, jsonb_object_keys(f.coefs) k
  ),
  p as (select (select intercept from f) + coalesce(sum(contrib), 0) pred from c)
  select jsonb_build_object(
    'made_on', (select x.j ->> 'trade_date' from x),
    'target_date', (select x.j ->> 'target_date' from x),
    'direction', case when p.pred >= 0 then 'naik' else 'turun' end,
    'confidence', public.norm_cdf(abs(p.pred) / greatest((select neutral_band from sg), 1e-6)),
    'pred_return', p.pred,
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('feature', k, 'contribution', round(contrib::numeric, 6)) order by abs(contrib) desc), '[]'::jsonb)
                from (select k, contrib from c order by abs(contrib) desc limit 3) t),
    'computed_at', now())
  from p where exists (select 1 from f) and exists (select 1 from x)
$$;

create or replace function public.market_outlook() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m text; snap jsonb; dyn jsonb;
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  select forecast_mode into m from public.profiles where id = auth.uid();
  snap := (select jsonb_build_object('made_on', made_on, 'target_date', target_date, 'direction', direction,
      'confidence', confidence, 'pred_return', pred_return, 'reasons', reasons)
    from public.forecasts where model_id = (select id from public.model_versions where active order by created_at desc limit 1)
    order by made_on desc limit 1);
  if coalesce(m, 'stabil') = 'dinamis' then
    dyn := public.outlook_dinamis();
    if dyn is not null then
      return dyn || jsonb_build_object('mode', 'dinamis', 'snapshot_direction', snap -> 'direction', 'snapshot_confidence', snap -> 'confidence');
    end if;
  end if;
  if snap is null then return null; end if;
  return snap || jsonb_build_object('mode', 'stabil');
end $$;

revoke all on function public.outlook_dinamis() from public, anon, authenticated;
revoke all on function public.set_forecast_mode(text) from public, anon;
grant execute on function public.set_forecast_mode(text) to authenticated;
