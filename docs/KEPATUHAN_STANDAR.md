# Kepatuhan terhadap "Standar Pengembangan Aplikasi" (lembar DATABASE, BACKEND, API, FRONTEND)

Status: ✅ dipenuhi · 🟡 sebagian · ⬜ belum (rencana). Fokus pada butir **Merah (Wajib)** dan topik yang diminta: cache, skalabilitas, NULL.

## Database
| Butir standar | Status | Bukti / catatan |
|---|---|---|
| Primary/Foreign/Unique/Check/NOT NULL/Default | ✅ | `0001_core.sql`; tabel fakta berkunci komposit, `check (close >= 0)` dst. |
| Penanganan NULL | ✅ | Harga tak tersedia → NULL (bukan 0) di `fact_stock_daily`; `rankings` memakai `nulls last`; formatter UI (`format.ts`) aman terhadap NULL/NaN; komponen klien memakai `?? []`/`?? 0`; didokumentasikan di `docs/KAMUS_DATA.md`. |
| Strategi index (Composite, Partial, Hindari over/under-index) | ✅ | PK komposit + `fact_stock_daily_date_idx (trade_date desc, value desc)`; indeks FK (`0006`); BRIN berlebih dihapus (`0010`). Query utama 8–9 ms pada 1,4 juta baris (diukur `EXPLAIN ANALYZE`). |
| Optimasi query (execution plan, kolom selektif, parameterized) | ✅ | RPC memakai parameter bind, `limit`, keyset pagination (`stock_table.p_after`). |
| Statistik/ANALYZE, autovacuum | ✅ | `ANALYZE` setelah impor massal; autovacuum agresif + `fillfactor 70` pada `feat_*_state` (`0010`). |
| RLS / Least privilege / Role | ✅ | RLS semua tabel; fungsi `SECURITY DEFINER` memeriksa peran sendiri; `search_path=''`; satu kebijakan permisif per peran/aksi (advisor "multiple permissive policies" 17 → 0; `0010`, `0011`). |
| Migrasi berversi, rollback | 🟡 | 12 migrasi berurutan di Git-able folder; rollback manual (belum ada skrip *down*). |
| Backup / PITR / Restore test | 🟡 | Mengandalkan backup harian paket Pro Supabase; PITR add-on & uji restore belum dijalankan. |
| Data quality / validation | ✅ | `data_quality()` + kartu di Admin; constraint tabel; impor memfilter baris tak valid. |
| Retensi data | ✅ | `pipeline_maintenance()` memangkas log/komponen skor lama; `stock_score_components` 90 hari. |
| Partisi tabel | ⬜ | Belum perlu (1,4 juta baris, 382 MB); ambang rencana: partisi per tahun bila > 20 juta baris. |
| Connection pool | ✅ | PostgREST/Supavisor dikelola Supabase; klien memakai REST, bukan koneksi langsung. |

## Backend / API
| Butir | Status | Bukti |
|---|---|---|
| Caching (TTL, invalidation, response cache) | ✅ | Server: `"use cache"` + `cacheLife` + `cacheTag("market")` untuk semua pembaca data publik, dibatalkan oleh `/api/revalidate` setelah data baru. Klien: `src/lib/client-cache.ts` (TTL, dedupe in-flight, stale-on-error, memori saja) dipakai grafik, peringkat, daftar saham, broker, analisis, ramalan; diuji `tests/client-cache.test.ts`. |
| Rate limiting / Throttling | ✅ | `rateLimitShared` (Postgres atomik `hit_rate_limit`, lintas instans) di pembayaran, CSV, hapus akun; gagal-aman ke in-memory. |
| Request validation / Schema | ✅ | zod di endpoint pembayaran; RPC memvalidasi argumen; Midtrans diverifikasi tanda tangan SHA-512 + jumlah. |
| Idempotensi | ✅ | Webhook Midtrans idempoten (`payment_events`); `upsert` pada impor. |
| Error standar / status HTTP | ✅ | JSON `{error}` dengan 400/401/403/404/429/500/503 yang akurat. |
| Security header, CORS, SSRF, injeksi | ✅ | `next.config.ts` (CSP dkk.); tidak ada SQL mentah dari klien. |
| Health check | ✅ | `/api/health`. |
| Observabilitas (log terstruktur, metrik) | 🟡 | `ingest_log`, `pipeline_freshness_check`, `data_quality`; belum ada APM/log terpusat. |
| Pengujian: unit/integrasi/beban | 🟡 | 27 tes unit (vitest); `scripts/uji-beban.mjs`: 150 koneksi bersamaan, 339 req/dtk, 0 gagal, p95 ≈ 0,85 dtk (termasuk jaringan internet). E2E belum ada. |
| Cache terdistribusi (Redis) | ⬜ | Belum perlu: cache Next.js + CDN + cache klien menutup kebutuhan; tambahkan Upstash bila trafik > beberapa ribu RPS. |
| Dokumentasi API (OpenAPI) | ⬜ | Endpoint sedikit (6); dijelaskan di README. |

## Frontend
Skeleton/empty/error state, lazy loading, tema, aksesibilitas (landmark, `aria-*`, skip-link), responsif sudah ada; audit Lighthouse/CWV belum dijalankan.

## Rekomendasi berikutnya
1. Aktifkan `enable_pipeline_cron()` dan monitor `data_quality()` harian.
2. Aktifkan PITR + uji restore berkala; aktifkan *leaked password protection* di Auth.
3. Tambah e2e (Playwright) dan APM (Sentry) sebelum peluncuran publik.
