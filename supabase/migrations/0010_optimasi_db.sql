-- Optimasi & kepatuhan standar (DATABASE / BACKEND): kebijakan RLS tidak ganda, indeks tidak berlebih,
-- autovacuum tabel berputar tinggi, search_path fungsi, serta laporan kualitas data untuk admin.

-- 1) Hindari "multiple permissive policies": kebijakan *_admin (FOR ALL) dipecah menjadi INSERT/UPDATE/DELETE
--    bila tabel sudah punya kebijakan SELECT terbuka (using true) — SELECT tidak lagi dievaluasi dua kali.
do $$
declare p record; roles text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public' and cmd = 'ALL' and policyname like '%\_admin'
      and exists (select 1 from pg_policies q where q.schemaname = 'public' and q.tablename = pg_policies.tablename and q.cmd = 'SELECT' and q.qual = 'true')
  loop
    roles := array_to_string(p.roles, ', ');
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to %s with check (%s)', p.policyname || '_ins', p.tablename, roles, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)', p.policyname || '_upd', p.tablename, roles, p.qual, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for delete to %s using (%s)', p.policyname || '_del', p.tablename, roles, p.qual);
  end loop;
end $$;

drop policy if exists presets_own on public.user_presets;
create policy presets_ins on public.user_presets for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_premium()));
create policy presets_upd on public.user_presets for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_premium())) with check (user_id = (select auth.uid()) and (select public.is_premium()));
create policy presets_del on public.user_presets for delete to authenticated using (user_id = (select auth.uid()));

-- 2) Indeks: BRIN trade_date berlebih (tertutup oleh fact_stock_daily_date_idx dan PK) — hemat ruang & biaya tulis.
drop index if exists public.fact_stock_daily_brin;

-- 3) Tabel berputar tinggi (UPSERT harian): autovacuum lebih agresif + ruang untuk HOT update.
alter table public.feat_indicator_state set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02, fillfactor = 70);
alter table public.feat_stock_state set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02, fillfactor = 70);
alter table public.fact_stock_daily set (autovacuum_analyze_scale_factor = 0.02);

-- 4) Fungsi murni: kunci search_path.
alter function public.norm_cdf(double precision) set search_path = '';

-- 5) Laporan kualitas data (Data Quality / Data Validation) — hanya admin.
create or replace function public.data_quality() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d date; r jsonb;
begin
  if not public.is_admin() then raise exception 'Khusus admin'; end if;
  select max(trade_date) into d from public.fact_stock_daily;
  select jsonb_build_object(
    'tanggal_terakhir', d,
    'saham_hari_terakhir', (select count(*) from public.fact_stock_daily where trade_date = d),
    'saham_min_30_hari', (select min(c) from (select count(*) c from public.fact_stock_daily where trade_date > d - 30 group by trade_date) t),
    'baris_tanpa_perubahan_persen', (select count(*) from public.fact_stock_daily where trade_date = d and change_pct is null),
    'baris_tanpa_transaksi', (select count(*) from public.fact_stock_daily where trade_date = d and volume = 0),
    'baris_high_lt_low', (select count(*) from public.fact_stock_daily where high is not null and low is not null and high < low),
    'baris_close_di_luar_rentang', (select count(*) from public.fact_stock_daily where high is not null and low is not null and close > 0 and (close > high or close < low)),
    'kode_tanpa_dim_stock', (select count(*) from (select distinct stock_code from public.fact_stock_daily where trade_date = d) x where not exists (select 1 from public.dim_stock s where s.code = x.stock_code)),
    'hari_tanpa_data_broker_30h', (select count(*) from (select distinct trade_date from public.fact_stock_daily where trade_date > d - 30) x where not exists (select 1 from public.fact_broker_daily b where b.trade_date = x.trade_date)),
    'hari_tanpa_ihsg_30h', (select count(*) from (select distinct trade_date from public.fact_stock_daily where trade_date > d - 30) x where not exists (select 1 from public.fact_index_daily i where i.index_code = 'COMPOSITE' and i.trade_date = x.trade_date)),
    'ramalan_terakhir', (select max(made_on) from public.forecasts),
    'ukuran_db_mb', (select round(pg_database_size(current_database()) / 1048576.0))
  ) into r;
  return r;
end $$;
revoke all on function public.data_quality() from public, anon;
grant execute on function public.data_quality() to authenticated;

-- 6) Kamus data (komentar skema) untuk tabel utama.
comment on table public.fact_stock_daily is 'Ringkasan perdagangan harian per saham (IDX). Kunci: (stock_code, trade_date). value/frequency/foreign_* 0 bila sumber Yahoo.';
comment on column public.fact_stock_daily.change_pct is 'Persen ubah terhadap penutupan sebelumnya; NULL bila penutupan sebelumnya tidak ada (saham baru).';
comment on column public.fact_stock_daily.open_price is 'Harga pembukaan; NULL bila tidak ada transaksi (IDX mengirim 0, dinormalkan ke NULL).';
comment on column public.fact_stock_daily.foreign_buy is 'Volume beli asing (lembar), sesuai kolom ForeignBuy IDX.';
comment on table public.fact_broker_daily is 'Ringkasan perdagangan harian per broker (volume, value, frekuensi).';
comment on table public.fact_index_daily is 'OHLC harian indeks (COMPOSITE = IHSG).';
comment on table public.fact_market_daily is 'Harga penutupan harian komoditas, kurs, dan indeks global (Yahoo).';
comment on table public.forecasts is 'Ramalan arah IHSG hari bursa berikutnya; tidak dapat diubah setelah dibuat (trigger).';
comment on table public.evaluations is 'Hasil nyata tiap ramalan dan ketepatannya.';
comment on table public.feat_indicator_state is 'Status kumulatif tiap indikator (rata-rata searah, korelasi) untuk perhitungan walk-forward; hanya memuat data sampai last_date.';
comment on function public.market_outlook() is 'Ramalan pasar terbaru untuk pengguna Premium; mengikuti profiles.forecast_mode (stabil/dinamis).';
