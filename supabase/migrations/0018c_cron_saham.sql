-- 0018c: jadwal harian ETL dan model per saham (belum diterapkan; jalankan sendiri di SQL Editor Supabase).
select cron.schedule('stock-etl',    '40 12 * * 1-5', $c$select public.run_stock_etl(current_date - 15)$c$);
select cron.schedule('stock-model',  '50 12 * * 1-5', $c$select public.run_stock_model(current_date - 10, 2)$c$);
select cron.schedule('stock-finish', '30 13 * * 1-5', $c$select public.finish_stock_model()$c$);
