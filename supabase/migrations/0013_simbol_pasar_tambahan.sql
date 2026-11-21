-- Simbol pasar tambahan: batu bara, kurs Asia/Timur Tengah, indeks regional & indeks dolar (Yahoo Finance).
insert into public.dim_market_symbol (symbol, name, category) values
  ('MTF=F', 'Batu Bara (Newcastle)', 'komoditas'),
  ('USDVND=X', 'USD/VND', 'kurs'),
  ('USDPHP=X', 'USD/PHP', 'kurs'),
  ('USDSAR=X', 'USD/SAR', 'kurs'),
  ('USDKRW=X', 'USD/KRW', 'kurs'),
  ('DX-Y.NYB', 'Indeks Dolar AS (DXY)', 'kurs'),
  ('^STI', 'Straits Times (Singapura)', 'indeks_global'),
  ('^KLSE', 'FTSE Bursa Malaysia KLCI', 'indeks_global'),
  ('000001.SS', 'Shanghai Composite', 'indeks_global'),
  ('^AXJO', 'ASX 200 (Australia)', 'indeks_global'),
  ('^FTSE', 'FTSE 100 (Inggris)', 'indeks_global'),
  ('^GDAXI', 'DAX (Jerman)', 'indeks_global')
on conflict (symbol) do nothing;
