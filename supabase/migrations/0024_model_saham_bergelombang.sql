-- Model saham: kirim batch dalam gelombang kecil (10 panggilan per menit) agar fungsi edge tidak kehabisan sumber daya (WORKER_RESOURCE_LIMIT).
-- Sebelumnya job `stock-model` mengirim sekitar 108 panggilan sekaligus pada 12:50 UTC dan hampir semuanya gagal (HTTP 546).
create or replace function public.run_stock_model_wave(p_wave int, p_from date default current_date - 10, p_batch int default 2, p_per_wave int default 10)
returns int language plpgsql security definer set search_path = '' as $$
declare total int; o int; n int := 0;
begin
  select count(*) into total from dwh.universe;
  o := p_wave * p_per_wave * p_batch;
  while o < total and n < p_per_wave loop
    perform public.call_pipeline('run-model-saham', jsonb_build_object('offset', o, 'limit', p_batch, 'from', p_from));
    o := o + p_batch; n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.run_stock_model_wave(int, date, int, int) from public, anon, authenticated;

-- Gelombang 0..12 pada 12:50-13:02 UTC (Sen-Jum); 'stock-finish' tetap 13:30 UTC.
select cron.unschedule('stock-model');
select cron.schedule('stock-model-w' || w, (50 + w) % 60 || ' ' || (12 + (50 + w) / 60) || ' * * 1-5', format('select public.run_stock_model_wave(%s)', w))
from generate_series(0, 12) w;
