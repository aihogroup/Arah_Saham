-- Aktifkan ridge_mv (ridge multivariat setara Admin). ridge_v1, ridge_v2 dan suara_v1 tetap berjalan sebagai pembanding.
update public.model_versions set active = (id = 'ridge_mv') where id in ('ridge_v1', 'ridge_v2', 'suara_v1', 'ridge_mv');
select cron.schedule('model-ridge-mv', '34 12 * * 1-5', $$select public.call_pipeline('run-ridge-mv', '{}')$$);
-- accuracy_summary_last(p_n): ringkasan akurasi pada N ramalan terakhir yang sudah terbukti (terpasang di database).
