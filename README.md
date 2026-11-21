# Arah Saham

Platform analisis saham IDX untuk trading harian (freemium). Next.js 16 (Cache Components) + Supabase.

> **Data:** database kini berisi data **nyata dari Yahoo Finance** (99 saham IDX likuid, IHSG `^JKSE`, komoditas, kurs, indeks global; 2022 → sekarang). Data demo sudah dihapus. Keterbatasan: Yahoo hanya menyediakan OHLC + volume, jadi **nilai transaksi = close × volume (perkiraan)**, dan **frekuensi, net asing, serta broker kosong** (endpoint IDX di Postman diblokir Cloudflare, 403). Keanggotaan indeks (IDX30, LQ45, dll.) kosong sampai diunggah admin lewat `/admin/indeks`.

## Menjalankan

```powershell
npm install --legacy-peer-deps
copy .env.example .env.local   # lalu isi nilainya
npm run dev
npm test          # 20 tes unit (ridge walk-forward, Midtrans, format)
npm run build
```

### Variabel lingkungan (`.env.local`)

| Nama | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sudah terisi (proyek `txjepqdmhccgggdrkuva`). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Wajib** untuk webhook Midtrans, hapus akun, beri premium manual. Ambil dari Dashboard → Project Settings → API. Jangan diawali `NEXT_PUBLIC_`. |
| `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` | Dari dashboard Midtrans (mulai dengan sandbox). |
| `NEXT_PUBLIC_SITE_URL` | URL publik (sitemap, tautan email). |
| `REVALIDATE_SECRET` | Rahasia untuk `POST /api/revalidate` (header `x-revalidate-secret`). |

## Arsitektur singkat

- **Halaman publik** di-cache (PPR + `"use cache"`); data publik lewat RPC dengan batas baris untuk pengunjung. Fitur login dimuat di klien dengan RLS/RPC sebagai penjaga sebenarnya.
- **Peran**: pengunjung, gratis, premium (`is_premium()`), admin (`is_admin()`). Peran selalu dibaca dari database.
- **Mesin skor tunggal** (`supabase/migrations/0003_scoring.sql`) + **ridge walk-forward** (Edge Function `run-model`). Ramalan tidak bisa diubah (trigger) dan dievaluasi terhadap pembanding.
- **Pipeline**: Edge Function `ingest` (sumber `idx`, `idx_import`, `yahoo`, `intraday`) → `raw_ingest` → validasi/karantina → upsert → `ingest_log`. Dijadwalkan pg_cron.
- **Pembayaran**: Midtrans Snap; webhook `/api/midtrans/notification` memverifikasi SHA-512, idempoten lewat `payment_events`, mencocokkan nominal.

## Menuju produksi

1. **Buat admin pertama**: daftar lewat situs, lalu di SQL Editor:
   `insert into public.user_roles (user_id, role) select id,'admin' from auth.users where email = 'EMAIL_ANDA';`
2. **Supabase Auth** (Dashboard): wajibkan verifikasi email, atur Site URL & Redirect URL (`/auth/callback`), SMTP sendiri, batas laju, kebijakan kata sandi, dan aktifkan MFA untuk admin.
3. **Data nyata**: sudah di-backfill dari Yahoo (`source: yahoo_stocks | yahoo_index | yahoo`), lalu `run_scoring` dan `run-model` (`{"from":"2022-01-01"}` untuk backfill ramalan walk-forward). Untuk menambah saham, tambahkan di `/admin/saham` lalu jalankan `select public.call_yahoo_stocks(1500);`.
4. **Jadwal harian**: `select public.enable_pipeline_cron();` di SQL Editor (matikan dengan `disable_pipeline_cron()`). Mengambil Yahoo setelah bursa tutup, lalu skor dan model.
5. **Sumber IDX**: situs idx.co.id memblokir IP cloud Supabase (Cloudflare 403). Gunakan worker/jalur terpisah (mis. mesin lokal/VPS Indonesia) yang mengirim ke endpoint `ingest` mode `idx_import`, atau berlangganan penyedia data berlisensi. Fungsi ini tidak mencoba melewati proteksi bot.
6. **Midtrans**: set URL notifikasi ke `https://DOMAIN/api/midtrans/notification`, uji di sandbox sebelum produksi.
7. **Hukum**: halaman Syarat/Privasi/Disclaimer hanyalah draf. Tinjau oleh konsultan hukum (UU PDP, OJK, lisensi data BEI/Yahoo untuk penggunaan komersial).
8. **Observabilitas**: tambahkan Sentry/log drain dan CI (lint + test + build) sesuai kebutuhan; tambahkan CSP ketat berbasis nonce.

## Struktur

- `supabase/migrations/` — skema, fitur, skor, RLS/RPC, cron, indeks (0001–0006)
- `supabase/functions/` — `ingest`, `run-model`, `probe-sources`, `_shared/ridge.ts`
- `supabase/seed_demo.sql` — seed demo (dapat dihapus dengan `purge_demo()`)
- `src/app/(site)` publik · `(app)` area login · `(auth)` masuk/daftar · `admin` panel · `api` route handler

## Data saham lengkap dari IDX (impor dari aplikasi Admin lokal)
IDX memblokir akses dari cloud (Cloudflare), jadi data "Ringkasan Saham" yang sudah disinkronkan aplikasi Admin ke Supabase lokal dipindahkan ke Supabase Arah Saham:
```
node scripts/impor-saham-lokal.mjs --kering     # uji: hanya menghitung baris
node scripts/impor-saham-lokal.mjs              # impor sungguhan (butuh SUPABASE_SERVICE_ROLE_KEY di .env.local)
node scripts/impor-saham-lokal.mjs --sejak 2026-11-01   # susulan harian
node scripts/isi-pasar-yahoo.mjs                  # riwayat penuh komoditas/kurs/indeks global dari Yahoo (semua simbol aktif)
node scripts/isi-pasar-yahoo.mjs MTF=F ^STI       # hanya simbol tertentu
```
Setelah impor jalankan `select public.run_scoring('2020-01-02', current_date)` per potongan ≤ 9 bulan, lalu kosongkan `evaluations, forecasts, model_fits` dan panggil `run-model` dengan `{"from":"2022-01-01"}`. Jalankan skrip susulan setiap hari setelah Admin lokal menyinkronkan data IDX; Yahoo hanya dipakai untuk saham yang belum punya data IDX.
