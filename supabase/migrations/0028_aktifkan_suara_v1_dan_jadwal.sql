-- Aktifkan model suara_v1 (ridge_v1 tetap berjalan sebagai pembanding, ridge_v2 sebagai bahan baku).
update public.model_versions set active = (id = 'suara_v1') where id in ('ridge_v1', 'ridge_v2', 'suara_v1');

-- Jadwal harian (UTC, Sen-Jum): skor suara 12:20 -> model v1 12:30 (sudah ada) -> ridge_v2 12:32 -> suara_v1 12:36
select cron.schedule('vote-scores', '20 12 * * 1-5', 'select public.refresh_vote_scores()');
select cron.schedule('model-v2', '32 12 * * 1-5', $$select public.call_pipeline('run-model', '{"model_id":"ridge_v2"}')$$);
select cron.schedule('model-suara', '36 12 * * 1-5', 'select public.build_suara_forecasts(current_date - 10)');

-- Akurasi per tahun untuk model aktif (premium), dengan pembanding selalu naik.
create or replace function public.accuracy_by_year()
returns table (yr int, n_called int, hit_rate float8, always_up_rate float8, up_share float8)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_premium() then raise exception 'Fitur premium'; end if;
  return query
  select extract(year from e.made_on)::int, count(e.hit)::int, avg(e.hit::int)::float8,
    avg(e.baseline_up_hit::int) filter (where e.hit is not null)::float8, avg((e.pred_dir = 'naik')::int)::float8
  from public.evaluations e
  where e.model_id = (select id from public.model_versions where active order by created_at desc limit 1) and e.hit is not null
  group by 1 order by 1 desc;
end $$;
revoke all on function public.accuracy_by_year() from public, anon;
grant execute on function public.accuracy_by_year() to authenticated;
