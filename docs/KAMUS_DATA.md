# Kamus data (tabel utama)

Skema lengkap ada di `supabase/migrations/`. Komentar tabel/kolom juga disimpan di database (`obj_description`).
Aturan NULL: kolom harga yang tidak tersedia disimpan **NULL** (bukan 0); semua formatter UI menampilkan "–" untuk NULL/NaN.

| Tabel | Kunci | Keterangan |
|---|---|---|
| `dim_stock` | `code` | Master saham: nama, sektor (NULL bila belum dikelompokkan), papan, jumlah saham tercatat, `active`. |
| `dim_broker` | `code` | Master broker (kode 2–4 karakter). |
| `fact_stock_daily` | `(stock_code, trade_date)` | Ringkasan harian IDX. `close`, `volume`, `value`, `frequency`, `foreign_*` NOT NULL (default 0). `open_price`, `high`, `low`, `prev_close`, `bid`, `offer`, `change`, `change_pct` NULL bila tidak ada transaksi/pembanding. `foreign_buy/sell` = volume (lembar). `source` = `idx` atau `yahoo` (estimasi). |
| `fact_broker_daily` | `(broker_code, trade_date)` | Volume, nilai, frekuensi per broker. |
| `fact_index_daily` | `(index_code, trade_date)` | OHLC indeks; `COMPOSITE` = IHSG. |
| `fact_market_daily` | `(symbol, trade_date)` | Penutupan komoditas, kurs, indeks global (Yahoo). |
| `feat_*`, `stock_scores` | — | Fitur turunan skor harian; dapat dibuat ulang dari tabel fakta (`run_scoring`). Status kumulatif (`feat_*_state`) hanya maju per tanggal. |
| `forecasts` | `(model_id, made_on)` | Ramalan arah IHSG hari berikutnya; tidak dapat diubah (trigger). `direction` ∈ {naik, turun}. |
| `evaluations` | `(model_id, made_on)` | Hasil nyata & ketepatan (`hit`). |
| `profiles` | `id` (= auth.users.id) | Profil; `forecast_mode` ∈ {stabil, dinamis}; kolom opsional NULL. |
| `subscriptions`, `orders`, `payment_events` | — | Langganan & pembayaran Midtrans (ditulis server saja). |
| `rate_limits` | `key` | Penghitung pembatas laju terdistribusi (UNLOGGED, tanpa kebijakan RLS). |

Dimensi kualitas data dicek oleh `public.data_quality()` (admin, halaman *Admin → Model & data*).
