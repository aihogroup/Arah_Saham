-- Data DEMO sintetis (source = 'demo'). BUKAN data pasar asli. Hapus dengan: select public.purge_demo();
select setseed(0.42);

insert into public.dim_index (code, name, description, is_benchmark, sort_order) values
 ('COMPOSITE','IHSG','Indeks Harga Saham Gabungan',true,0),
 ('IDX30','IDX30','30 saham likuid kapitalisasi besar',false,1),
 ('LQ45','LQ45','45 saham paling likuid',false,2),
 ('IDX80','IDX80','80 saham likuid',false,3),
 ('KEHATI','SRI-KEHATI','Saham dengan praktik berkelanjutan',false,4),
 ('IDXHIDIV20','IDX High Dividend 20','20 saham dividen tinggi',false,5)
on conflict do nothing;

insert into public.dim_stock (code, name, sector, board, listed_shares, source) values
('BBCA','Bank Central Asia Tbk.','Keuangan','Utama',123000000000,'demo'),('BBRI','Bank Rakyat Indonesia Tbk.','Keuangan','Utama',151000000000,'demo'),
('BMRI','Bank Mandiri Tbk.','Keuangan','Utama',93000000000,'demo'),('BBNI','Bank Negara Indonesia Tbk.','Keuangan','Utama',37000000000,'demo'),
('TLKM','Telkom Indonesia Tbk.','Infrastruktur','Utama',99000000000,'demo'),('ASII','Astra International Tbk.','Perindustrian','Utama',40000000000,'demo'),
('UNVR','Unilever Indonesia Tbk.','Barang Konsumsi Primer','Utama',38000000000,'demo'),('ICBP','Indofood CBP Sukses Makmur Tbk.','Barang Konsumsi Primer','Utama',11000000000,'demo'),
('INDF','Indofood Sukses Makmur Tbk.','Barang Konsumsi Primer','Utama',8800000000,'demo'),('GOTO','GoTo Gojek Tokopedia Tbk.','Teknologi','Utama',1100000000000,'demo'),
('BREN','Barito Renewables Energy Tbk.','Energi','Utama',133000000000,'demo'),('AMMN','Amman Mineral Internasional Tbk.','Barang Baku','Utama',72000000000,'demo'),
('ADRO','Alamtri Resources Indonesia Tbk.','Energi','Utama',30000000000,'demo'),('PTBA','Bukit Asam Tbk.','Energi','Utama',11000000000,'demo'),
('ANTM','Aneka Tambang Tbk.','Barang Baku','Utama',24000000000,'demo'),('MDKA','Merdeka Copper Gold Tbk.','Barang Baku','Utama',24000000000,'demo'),
('ITMG','Indo Tambangraya Megah Tbk.','Energi','Utama',1100000000,'demo'),('BYAN','Bayan Resources Tbk.','Energi','Utama',33000000000,'demo'),
('CPIN','Charoen Pokphand Indonesia Tbk.','Barang Konsumsi Primer','Utama',16000000000,'demo'),('JPFA','Japfa Comfeed Indonesia Tbk.','Barang Konsumsi Primer','Utama',11000000000,'demo'),
('KLBF','Kalbe Farma Tbk.','Kesehatan','Utama',46000000000,'demo'),('SMGR','Semen Indonesia Tbk.','Barang Baku','Utama',6900000000,'demo'),
('INKP','Indah Kiat Pulp & Paper Tbk.','Barang Baku','Utama',5400000000,'demo'),('TPIA','Chandra Asri Pacific Tbk.','Barang Baku','Utama',86000000000,'demo'),
('MAPI','Mitra Adiperkasa Tbk.','Barang Konsumsi Non-Primer','Utama',16000000000,'demo'),('ACES','Aspirasi Hidup Indonesia Tbk.','Barang Konsumsi Non-Primer','Utama',17000000000,'demo'),
('ERAA','Erajaya Swasembada Tbk.','Barang Konsumsi Non-Primer','Utama',16000000000,'demo'),('EXCL','XL Axiata Tbk.','Infrastruktur','Utama',13000000000,'demo'),
('ISAT','Indosat Ooredoo Hutchison Tbk.','Infrastruktur','Utama',8000000000,'demo'),('TOWR','Sarana Menara Nusantara Tbk.','Infrastruktur','Utama',51000000000,'demo'),
('JSMR','Jasa Marga Tbk.','Infrastruktur','Utama',7200000000,'demo'),('PGAS','Perusahaan Gas Negara Tbk.','Energi','Utama',24000000000,'demo'),
('MEDC','Medco Energi Internasional Tbk.','Energi','Utama',25000000000,'demo'),('AKRA','AKR Corporindo Tbk.','Energi','Utama',20000000000,'demo'),
('UNTR','United Tractors Tbk.','Perindustrian','Utama',3700000000,'demo'),('HMSP','H.M. Sampoerna Tbk.','Barang Konsumsi Primer','Utama',116000000000,'demo'),
('GGRM','Gudang Garam Tbk.','Barang Konsumsi Primer','Utama',1900000000,'demo'),('BRPT','Barito Pacific Tbk.','Barang Baku','Utama',93000000000,'demo'),
('CTRA','Ciputra Development Tbk.','Properti','Utama',18000000000,'demo'),('BSDE','Bumi Serpong Damai Tbk.','Properti','Utama',21000000000,'demo'),
('PWON','Pakuwon Jati Tbk.','Properti','Utama',48000000000,'demo'),('SMRA','Summarecon Agung Tbk.','Properti','Utama',16000000000,'demo'),
('MIKA','Mitra Keluarga Karyasehat Tbk.','Kesehatan','Utama',14000000000,'demo'),('HEAL','Medikaloka Hermina Tbk.','Kesehatan','Utama',15000000000,'demo'),
('SIDO','Industri Jamu Sido Muncul Tbk.','Kesehatan','Utama',30000000000,'demo'),('MYOR','Mayora Indah Tbk.','Barang Konsumsi Primer','Utama',22000000000,'demo'),
('AMRT','Sumber Alfaria Trijaya Tbk.','Barang Konsumsi Primer','Utama',41000000000,'demo'),('EMTK','Elang Mahkota Teknologi Tbk.','Teknologi','Utama',58000000000,'demo'),
('BUKA','Bukalapak.com Tbk.','Teknologi','Utama',103000000000,'demo'),('ARTO','Bank Jago Tbk.','Keuangan','Utama',13000000000,'demo'),
('BRIS','Bank Syariah Indonesia Tbk.','Keuangan','Utama',46000000000,'demo'),('BTPS','Bank BTPN Syariah Tbk.','Keuangan','Utama',7700000000,'demo'),
('INCO','Vale Indonesia Tbk.','Barang Baku','Utama',9900000000,'demo'),('TINS','Timah Tbk.','Barang Baku','Utama',7400000000,'demo'),
('ESSA','ESSA Industries Indonesia Tbk.','Energi','Utama',17000000000,'demo'),('SRTG','Saratoga Investama Sedaya Tbk.','Keuangan','Utama',13000000000,'demo'),
('MBMA','Merdeka Battery Materials Tbk.','Barang Baku','Utama',107000000000,'demo'),('NCKL','Trimegah Bangun Persada Tbk.','Barang Baku','Utama',63000000000,'demo'),
('CUAN','Petrindo Jaya Kreasi Tbk.','Energi','Utama',11000000000,'demo'),('PANI','Pantai Indah Kapuk Dua Tbk.','Properti','Utama',16000000000,'demo')
on conflict do nothing;

insert into public.dim_broker (code, name) values
('AK','UBS Sekuritas Indonesia'),('BK','J.P. Morgan Sekuritas Indonesia'),('CC','Mandiri Sekuritas'),('CP','KB Valbury Sekuritas'),
('DR','RHB Sekuritas Indonesia'),('KZ','CLSA Sekuritas Indonesia'),('YP','Mirae Asset Sekuritas Indonesia'),('PD','Indo Premier Sekuritas'),
('NI','BNI Sekuritas'),('XL','Stockbit Sekuritas Digital'),('XC','Ajaib Sekuritas Asia'),('SQ','BCA Sekuritas'),
('RX','Macquarie Sekuritas Indonesia'),('MG','Semesta Indovest Sekuritas'),('LG','Trimegah Sekuritas Indonesia'),('OD','BRI Danareksa Sekuritas'),
('GR','Panin Sekuritas'),('EP','MNC Sekuritas'),('ZP','Maybank Sekuritas Indonesia'),('DX','Bahana Sekuritas')
on conflict do nothing;

insert into public.dim_market_symbol (symbol, name, category, usable_d1) values
('USDIDR=X','USD/IDR','kurs',true),('GC=F','Emas (Gold Futures)','komoditas',true),('CL=F','Minyak Mentah WTI','komoditas',true),
('^GSPC','S&P 500','indeks_global',true),('^IXIC','Nasdaq Composite','indeks_global',true),('^N225','Nikkei 225','indeks_global',true),
('^HSI','Hang Seng','indeks_global',true),('EIDO','iShares MSCI Indonesia ETF','proksi_id',true),('TLK','Telkom Indonesia ADR','proksi_id',true)
on conflict do nothing;

create temp table demo_days as
select d::date as d, row_number() over (order by d) as i
from generate_series('2022-01-03'::date, '2026-11-20'::date, interval '1 day') d
where extract(isodow from d) < 6 and random() > 0.03;

create temp table mf as
select d, i, 0.0003 + 0.009 * ((random()+random()+random()+random()-2) * 1.732) as r from demo_days;

-- IHSG
insert into public.fact_index_daily (index_code, trade_date, prev_close, close, change, change_pct, source)
select 'COMPOSITE', d, lag(c) over (order by d), c, c - lag(c) over (order by d),
       round(((c / nullif(lag(c) over (order by d),0) - 1) * 100)::numeric, 4), 'demo'
from (select d, round((6500 * exp(sum(ln(1 + r)) over (order by d)))::numeric, 4) as c from mf) x;

-- saham
create temp table stk as
select code, row_number() over (order by code) as k, 300 + floor(random() * 9000) as p0,
       0.6 + random() * 1.0 as beta, 2e6 + random() * 8e7 as base_vol
from public.dim_stock where source = 'demo';

create temp table sret as
select s.code, m.d, m.i, s.k, s.p0, s.base_vol,
       greatest(-0.2, least(0.2, s.beta * m.r + 0.014 * ((random()+random()+random()+random()-2) * 1.732))) as r
from stk s cross join mf m;

insert into public.fact_stock_daily (stock_code, trade_date, prev_close, open_price, high, low, close, change, change_pct, volume, value, frequency, foreign_buy, foreign_sell, listed_shares, source)
select code, d, lag(c) over w, c0, greatest(c, c0) * (1 + 0.004 * random()), least(c, c0) * (1 - 0.004 * random()), c,
       c - lag(c) over w, round(((r) * 100)::numeric, 4),
       v::bigint, (v * c)::numeric(22,0), (v / (200 + random() * 400))::bigint,
       (v * c * (0.1 + 0.2 * random()) * (1 + 0.5 * sign(r)))::numeric(22,0), (v * c * (0.1 + 0.2 * random()) * (1 - 0.5 * sign(r)))::numeric(22,0),
       ds.listed_shares, 'demo'
from (
  select code, d, r, round((p0 * exp(sum(ln(1 + r)) over (partition by code order by d)))::numeric, 0) as c,
         round((p0 * exp(coalesce(sum(ln(1 + r)) over (partition by code order by d rows between unbounded preceding and 1 preceding), 0)))::numeric, 0) as c0,
         base_vol * (0.4 + random()) * (1 + 25 * abs(r)) as v
  from sret) q
join public.dim_stock ds on ds.code = q.code
window w as (partition by q.code order by d);

-- broker: total nilai pasar x pangsa; 4 broker pertama membawa sinyal lemah terhadap arah IHSG hari berikutnya
create temp table brk as
select code, row_number() over (order by code) as k, (random() + 0.2) as w from public.dim_broker;
create temp table mday as
select d, i, lead(r) over (order by d) as r_next, (select sum(value) from public.fact_stock_daily f where f.trade_date = mf.d) as tv from mf;

insert into public.fact_broker_daily (broker_code, trade_date, volume, value, frequency, source)
select b.code, m.d,
  (m.tv / 5000 * b.w / sw.s * (1 + case when b.k <= 4 then 0.35 * sign(coalesce(m.r_next, 0)) * (1.0 / b.k) else 0 end) * (0.7 + 0.6 * random()))::numeric(22,0),
  (m.tv * b.w / sw.s * (1 + case when b.k <= 4 then 0.35 * sign(coalesce(m.r_next, 0)) * (1.0 / b.k) else 0 end) * (0.7 + 0.6 * random()))::numeric(22,0),
  (m.tv / 3e6 * b.w / sw.s * (0.7 + 0.6 * random()))::bigint, 'demo'
from brk b cross join mday m cross join (select sum(w) as s from brk) sw
where m.tv is not null;

-- pasar global: return berkorelasi dengan return IHSG hari berikutnya (sinyal demo)
create temp table mk as
select s.symbol, s.rho, s.base, s.vol_s, m.d,
  s.rho * coalesce(m.r_next, 0) / 0.009 * s.vol_s + s.vol_s * ((random()+random()+random()+random()-2) * 1.732) as r
from (values ('USDIDR=X', -0.15, 16000.0, 0.004), ('GC=F', 0.0, 2300.0, 0.008), ('CL=F', 0.1, 80.0, 0.015),
             ('^GSPC', 0.35, 5000.0, 0.009), ('^IXIC', 0.3, 16000.0, 0.012), ('^N225', 0.15, 38000.0, 0.011),
             ('^HSI', 0.1, 18000.0, 0.013), ('EIDO', 0.45, 22.0, 0.012), ('TLK', 0.3, 20.0, 0.014)) s(symbol, rho, base, vol_s)
cross join mday m;
insert into public.fact_market_daily (symbol, trade_date, close, volume, source)
select symbol, d, round((base * exp(sum(ln(1 + greatest(-0.2, least(0.2, r)))) over (partition by symbol order by d)))::numeric, 4), 1000000, 'demo' from mk;

-- komposisi indeks (versi 1 sejak awal; LQ45 punya versi 2 untuk contoh masuk/keluar)
do $$
declare idx text; vid uuid; n int;
begin
  for idx, n in select * from (values ('IDX30',30),('LQ45',45),('IDX80',60),('KEHATI',20),('IDXHIDIV20',20)) t(i, n) loop
    insert into public.index_versions (index_code, effective_from, note) values (idx, '2022-01-03', 'Seed demo') returning id into vid;
    insert into public.index_members (version_id, stock_code)
      select vid, code from (select code from public.dim_stock where source = 'demo' order by md5(code || idx) limit n) s;
    insert into public.index_changes (index_code, stock_code, change_type, effective_date, version_id)
      select idx, stock_code, 'in', '2022-01-03', vid from public.index_members where version_id = vid;
  end loop;
  -- LQ45 versi 2: keluarkan 3, masukkan 3
  select id into vid from public.index_versions where index_code = 'LQ45' and version_no = 1;
  declare v2 uuid; outs text[]; ins text[];
  begin
    select array_agg(stock_code) into outs from (select stock_code from public.index_members where version_id = vid order by md5(stock_code) limit 3) o;
    select array_agg(code) into ins from (select code from public.dim_stock where source = 'demo' and code not in (select stock_code from public.index_members where version_id = vid) order by md5(code) limit 3) i;
    insert into public.index_versions (index_code, version_no, effective_from, note) values ('LQ45', 1, '2026-02-02', 'Evaluasi berkala (demo)') returning id into v2;
    insert into public.index_members (version_id, stock_code) select v2, stock_code from public.index_members where version_id = vid and stock_code <> all (outs);
    insert into public.index_members (version_id, stock_code) select v2, unnest(ins);
    update public.index_versions set effective_to = '2026-02-02', status = 'superseded' where id = vid;
    insert into public.index_changes (index_code, stock_code, change_type, effective_date, version_id)
      select 'LQ45', unnest(ins), 'in', '2026-02-02'::date, v2 union all select 'LQ45', unnest(outs), 'out', '2026-02-02'::date, v2;
  end;
end $$;

insert into public.model_versions (id, description, features, active) values
 ('ridge_v1','Ridge walk-forward: skor kelompok + breadth + musiman + momentum',
  array['g_broker_value','g_broker_volume','g_broker_frequency','g_komoditas','g_kurs','g_indeks_global','g_proksi_id','breadth_ratio','pct_above_ma20','net_foreign_ratio','value_up_log','seas_dow','seas_wom','seas_month','seas_yearend','mom1','mom5','mom20'], true)
on conflict do nothing;

insert into public.blog_posts (slug, title, excerpt, body_md, status, publish_at) values
 ('cara-membaca-kondisi-pasar-harian','Cara membaca kondisi pasar harian dalam 5 menit','Panduan singkat membaca IHSG, breadth, dan aliran dana tanpa istilah rumit.','## Mulai dari IHSG\n\nLihat arah dan besar perubahannya, lalu cek **breadth**: berapa saham naik dibanding turun.\n\n## Aliran dana\n\nPangsa nilai transaksi broker menunjukkan siapa yang paling aktif.\n\n*Konten ini bersifat edukasi dan bukan ajakan membeli atau menjual.*','published', now() - interval '3 days'),
 ('mengapa-akurasi-arah-harian-tidak-pernah-90-persen','Mengapa akurasi arah harian tidak pernah 90 persen','Penjelasan jujur tentang batas ramalan arah pasar harian.','Arah pasar harian sangat berisik. Akurasi realistis berada di kisaran 52–60 persen. Klaim yang jauh di atas itu patut dicurigai.','published', now() - interval '2 days'),
 ('apa-itu-ihsg-dan-mengapa-penting','Apa itu IHSG dan mengapa penting','Pengenalan IHSG untuk pemula.','IHSG adalah indeks gabungan seluruh saham tercatat di BEI. Ia menjadi tolok ukur kondisi pasar secara umum.','published', now() - interval '1 day')
on conflict do nothing;

create or replace function public.purge_demo() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.reset_scoring();
  delete from public.forecasts where false; -- forecasts bersifat permanen; hapus manual lewat TRUNCATE bila perlu
  delete from public.fact_stock_daily where source = 'demo';
  delete from public.fact_broker_daily where source = 'demo';
  delete from public.fact_index_daily where source = 'demo';
  delete from public.fact_market_daily where source = 'demo';
end $$;
revoke execute on function public.purge_demo() from public, anon, authenticated;
