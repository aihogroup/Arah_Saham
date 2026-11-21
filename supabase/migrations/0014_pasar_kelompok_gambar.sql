-- 0014: katalog pasar + riwayat per simbol, kelompok saham (sektor/papan/indeks), dan penyimpanan gambar blog.

-- 1) Katalog pasar: semua simbol aktif dengan perubahan berbagai periode (persen) dan sparkline 30 hari.
create or replace function public.market_catalog()
returns table (symbol text, name text, category text, last_date date, close numeric, change_pct numeric,
  chg_1w numeric, chg_1m numeric, chg_3m numeric, chg_ytd numeric, chg_1y numeric, first_date date, n_days bigint, spark numeric[])
language sql stable security definer set search_path = '' as $$
  select s.symbol, s.name, s.category, l.trade_date, l.close,
    (l.close / nullif(p.close, 0) - 1) * 100,
    (l.close / nullif(w.close, 0) - 1) * 100,
    (l.close / nullif(m.close, 0) - 1) * 100,
    (l.close / nullif(q.close, 0) - 1) * 100,
    (l.close / nullif(y.close, 0) - 1) * 100,
    (l.close / nullif(a.close, 0) - 1) * 100,
    st.first_date, st.n,
    (select array_agg(h.close order by h.trade_date) from (select x.close, x.trade_date from public.fact_market_daily x where x.symbol = s.symbol order by x.trade_date desc limit 30) h)
  from public.dim_market_symbol s
  cross join lateral (select x.trade_date, x.close from public.fact_market_daily x where x.symbol = s.symbol order by x.trade_date desc limit 1) l
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date < l.trade_date order by x.trade_date desc limit 1) p on true
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date <= l.trade_date - 7 order by x.trade_date desc limit 1) w on true
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date <= l.trade_date - 30 order by x.trade_date desc limit 1) m on true
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date <= l.trade_date - 91 order by x.trade_date desc limit 1) q on true
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date < date_trunc('year', l.trade_date)::date order by x.trade_date desc limit 1) y on true
  left join lateral (select x.close from public.fact_market_daily x where x.symbol = s.symbol and x.trade_date <= l.trade_date - 365 order by x.trade_date desc limit 1) a on true
  cross join lateral (select min(x.trade_date) first_date, count(*) n from public.fact_market_daily x where x.symbol = s.symbol) st
  where s.active
  order by s.category, s.name;
$$;

-- 2) Riwayat satu simbol. p_days <= 0 berarti seluruh riwayat.
create or replace function public.market_series(p_symbol text, p_days int default 365)
returns table (trade_date date, close numeric, change_pct numeric)
language sql stable security definer set search_path = '' as $$
  with bounds as (select max(x.trade_date) mx from public.fact_market_daily x where x.symbol = p_symbol),
  r as (
    select f.trade_date, f.close, (f.close / nullif(lag(f.close) over (order by f.trade_date), 0) - 1) * 100 as chg
    from public.fact_market_daily f, bounds b
    where f.symbol = p_symbol and (coalesce(p_days, 0) <= 0 or f.trade_date >= b.mx - (least(p_days, 20000) + 10)))
  select r.trade_date, r.close, r.chg from r where coalesce(p_days, 0) <= 0 or r.trade_date >= (select mx from bounds) - least(p_days, 20000) order by r.trade_date;
$$;

-- 3) Kelompok saham: sektor, papan, indeks. Kunci '-' = belum dikelompokkan.
create or replace function public.stock_groups(p_kind text)
returns table (grp text, label text, n bigint, advancers bigint, decliners bigint, avg_change numeric, total_value numeric)
language plpgsql stable security definer set search_path = '' as $$
declare d date := (select max(f.trade_date) from public.fact_stock_daily f);
begin
  if p_kind = 'sektor' then
    return query select coalesce(s.sector, '-'), coalesce(s.sector, 'Belum dikelompokkan'), count(*), count(*) filter (where f.change_pct > 0), count(*) filter (where f.change_pct < 0),
      round(avg(f.change_pct), 2), sum(f.value)
      from public.dim_stock s join public.fact_stock_daily f on f.stock_code = s.code and f.trade_date = d where s.active
      group by s.sector order by sum(f.value) desc nulls last;
  elsif p_kind = 'papan' then
    return query select coalesce(s.board, '-'), coalesce(s.board, 'Belum dikelompokkan'), count(*), count(*) filter (where f.change_pct > 0), count(*) filter (where f.change_pct < 0),
      round(avg(f.change_pct), 2), sum(f.value)
      from public.dim_stock s join public.fact_stock_daily f on f.stock_code = s.code and f.trade_date = d where s.active
      group by s.board order by count(*) desc;
  elsif p_kind = 'indeks' then
    return query select i.code, i.name, count(f.stock_code), count(*) filter (where f.change_pct > 0), count(*) filter (where f.change_pct < 0),
      round(avg(f.change_pct), 2), sum(f.value)
      from public.dim_index i
      left join lateral (select m.stock_code from public.index_members_on(i.code, d) m) mm on true
      left join public.fact_stock_daily f on f.stock_code = mm.stock_code and f.trade_date = d
      where i.code <> 'COMPOSITE' group by i.code, i.name, i.sort_order order by i.sort_order;
  else
    raise exception 'Jenis kelompok tidak dikenal';
  end if;
end $$;

-- 4) Anggota satu kelompok (pengunjung: 10 teratas; akun: hingga 500).
create or replace function public.group_stocks(p_kind text, p_value text, p_limit int default 10)
returns table (stock_code text, name text, sector text, board text, close numeric, change_pct numeric, value numeric, trade_date date, spark numeric[])
language plpgsql stable security definer set search_path = '' as $$
declare d date := (select max(f.trade_date) from public.fact_stock_daily f); anon boolean := (select auth.uid()) is null; lim int;
begin
  lim := case when anon then least(greatest(p_limit, 1), 10) else least(greatest(p_limit, 1), 500) end;
  if p_kind not in ('sektor', 'papan', 'indeks') then raise exception 'Jenis kelompok tidak dikenal'; end if;
  return query
  select s.code, s.name, s.sector, s.board, f.close, f.change_pct, f.value, f.trade_date,
    (select array_agg(h.close order by h.trade_date) from (select x.close, x.trade_date from public.fact_stock_daily x where x.stock_code = s.code and x.trade_date <= d order by x.trade_date desc limit 20) h)
  from public.dim_stock s join public.fact_stock_daily f on f.stock_code = s.code and f.trade_date = d
  where s.active and case p_kind
      when 'sektor' then s.sector is not distinct from nullif(p_value, '-')
      when 'papan' then s.board is not distinct from nullif(p_value, '-')
      else s.code in (select m.stock_code from public.index_members_on(p_value, d) m) end
  order by f.value desc, s.code
  limit lim;
end $$;

revoke all on function public.market_catalog(), public.market_series(text, int), public.stock_groups(text), public.group_stocks(text, text, int) from public;
grant execute on function public.market_catalog(), public.market_series(text, int), public.stock_groups(text), public.group_stocks(text, text, int) to anon, authenticated;

comment on function public.market_catalog() is 'Semua simbol pasar aktif dengan perubahan 1H/1M/3M/YTD/1T, rentang riwayat, dan sparkline.';
comment on function public.stock_groups(text) is 'Ringkasan kelompok saham menurut sektor, papan, atau indeks pada hari data terakhir.';

-- 5) Gambar blog: bucket publik (baca), tulis hanya admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy blog_images_admin_sel on storage.objects for select to authenticated using (bucket_id = 'blog-images' and (select public.is_admin()));
create policy blog_images_admin_ins on storage.objects for insert to authenticated with check (bucket_id = 'blog-images' and (select public.is_admin()));
create policy blog_images_admin_upd on storage.objects for update to authenticated using (bucket_id = 'blog-images' and (select public.is_admin())) with check (bucket_id = 'blog-images' and (select public.is_admin()));
create policy blog_images_admin_del on storage.objects for delete to authenticated using (bucket_id = 'blog-images' and (select public.is_admin()));
