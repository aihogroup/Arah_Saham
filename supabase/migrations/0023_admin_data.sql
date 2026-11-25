-- Penjelajah data untuk admin: membaca satu set data (tabel) per halaman, dengan filter tanggal dan kode.
-- Hanya admin. Hanya tabel pada daftar putih di bawah (data pasar dan referensi; tidak ada data pribadi pengguna).
create or replace function public.admin_data(
  p_set text, p_from date default null, p_to date default null, p_q text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rel text; dcol text; kcol text; cat text; w text := 'true'; ord text; lim int; off int;
  total bigint; approx boolean := false; est bigint; cols jsonb; rws jsonb;
begin
  if not public.is_admin() then raise exception 'Hanya admin' using errcode = '42501'; end if;

  select r.rel, r.dcol, r.kcol, r.cat into rel, dcol, kcol, cat from (values
    ('saham',        'public.fact_stock_daily',  'trade_date',     'stock_code', null),
    ('indeks_harian','public.fact_index_daily',  'trade_date',     'index_code', null),
    ('broker',       'public.fact_broker_daily', 'trade_date',     'broker_code', null),
    ('komoditas',    'public.fact_market_daily', 'trade_date',     'symbol', 'komoditas'),
    ('kurs',         'public.fact_market_daily', 'trade_date',     'symbol', 'kurs'),
    ('indeks_global','public.fact_market_daily', 'trade_date',     'symbol', 'indeks_global'),
    ('proksi_saham', 'public.fact_market_daily', 'trade_date',     'symbol', 'proksi_saham'),
    ('proksi_id',    'public.fact_market_daily', 'trade_date',     'symbol', 'proksi_id'),
    ('emiten',       'public.dim_stock',         null,             'code', null),
    ('free_float',   'public.stock_float',       'as_of',          'stock_code', null),
    ('daftar_broker','public.dim_broker',        null,             'code', null),
    ('daftar_indeks','public.dim_index',         null,             'code', null),
    ('daftar_simbol','public.dim_market_symbol', null,             'symbol', null),
    ('perubahan_indeks','public.index_changes',  'effective_date', 'stock_code', null),
    ('skor_saham',   'public.stock_scores',      'trade_date',     'stock_code', null),
    ('prediksi_saham','public.stock_forecasts',  'made_on',        'stock_code', null),
    ('breadth',      'public.feat_breadth',      'trade_date',     'trade_date', null),
    ('log_ingest',   'public.ingest_log',        'trade_date',     'source', null)
  ) r(id, rel, dcol, kcol, cat) where r.id = p_set;
  if rel is null then raise exception 'Set data tidak dikenal'; end if;

  lim := least(greatest(coalesce(p_limit, 50), 1), 200);
  off := least(greatest(coalesce(p_offset, 0), 0), 100000);

  if cat is not null then w := w || format(' and symbol in (select s.symbol from public.dim_market_symbol s where s.category = %L)', cat); end if;
  if dcol is not null and p_from is not null then w := w || format(' and %I >= %L', dcol, p_from); end if;
  if dcol is not null and p_to is not null then w := w || format(' and %I <= %L', dcol, p_to); end if;
  if nullif(btrim(p_q), '') is not null then
    w := w || format(' and %I::text ilike %L', kcol, replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%');
  end if;

  select reltuples::bigint into est from pg_class where oid = rel::regclass;
  if w = 'true' and est > 200000 then total := est; approx := true;
  else execute format('select count(*) from %s t where %s', rel, w) into total; end if;

  ord := case when dcol is not null then format('%I desc, %I', dcol, kcol) else format('%I', kcol) end;
  execute format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (select * from %s t where %s order by %s limit %s offset %s) q', rel, w, ord, lim, off) into rws;
  select jsonb_agg(a.attname order by a.attnum) into cols from pg_attribute a where a.attrelid = rel::regclass and a.attnum > 0 and not a.attisdropped;

  return jsonb_build_object('columns', cols, 'rows', rws, 'total', total, 'approx', approx, 'limit', lim, 'offset', off);
end $$;
revoke all on function public.admin_data(text, date, date, text, int, int) from public, anon;
grant execute on function public.admin_data(text, date, date, text, int, int) to authenticated;
