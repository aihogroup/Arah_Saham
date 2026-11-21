-- 0015: profil risiko, validasi usia 17–100 tahun, dan seasonality (rata-rata perubahan per bulan/hari).

-- 1) Hasil kuesioner toleransi risiko (skor 8–32; kategori tetap di risk_tolerance).
alter table public.profiles
  add column if not exists risk_score smallint check (risk_score between 8 and 32),
  add column if not exists risk_assessed_at timestamptz;

-- 2) Validasi usia di database (tidak bergantung pada formulir): 17–100 tahun.
create or replace function public.profiles_check_birth() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birth_date is not null then
    if new.birth_date > (current_date - interval '17 years')::date then raise exception 'Usia minimal 17 tahun'; end if;
    if new.birth_date < (current_date - interval '100 years')::date then raise exception 'Usia maksimal 100 tahun'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_birth_check on public.profiles;
create trigger profiles_birth_check before insert or update of birth_date on public.profiles
  for each row execute function public.profiles_check_birth();

-- 3) Seasonality bulanan: perubahan % tiap bulan kalender (penutupan akhir bulan vs akhir bulan sebelumnya;
--    bulan pertama data memakai penutupan pertama bulan itu). Sumber: market (simbol), index (kode indeks), stock (kode saham).
create or replace function public.seasonality(p_source text, p_key text)
returns table (yr int, mo int, ret numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_source not in ('market', 'index', 'stock') then raise exception 'Sumber tidak dikenal'; end if;
  return query
  with d as (
    select f.trade_date td, f.close c from public.fact_market_daily f where p_source = 'market' and f.symbol = p_key
    union all select f.trade_date, f.close from public.fact_index_daily f where p_source = 'index' and f.index_code = p_key
    union all select f.trade_date, f.close from public.fact_stock_daily f where p_source = 'stock' and f.stock_code = upper(p_key) and f.close > 0),
  m as (select date_trunc('month', td)::date mth, (array_agg(c order by td desc))[1] lc, (array_agg(c order by td))[1] fc from d group by 1),
  r as (select mth, lc, fc, lag(lc) over (order by mth) pc from m)
  select extract(year from r.mth)::int, extract(month from r.mth)::int, round(((r.lc / nullif(coalesce(r.pc, r.fc), 0)) - 1) * 100, 2)
  from r order by 1, 2;
end $$;

-- 4) Seasonality per hari dalam pekan (Senin–Jumat): rata-rata perubahan harian dan peluang naik.
create or replace function public.seasonality_dow(p_source text, p_key text)
returns table (dow int, n bigint, up bigint, down bigint, avg_ret numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_source not in ('market', 'index', 'stock') then raise exception 'Sumber tidak dikenal'; end if;
  return query
  with d as (
    select f.trade_date td, f.close c from public.fact_market_daily f where p_source = 'market' and f.symbol = p_key
    union all select f.trade_date, f.close from public.fact_index_daily f where p_source = 'index' and f.index_code = p_key
    union all select f.trade_date, f.close from public.fact_stock_daily f where p_source = 'stock' and f.stock_code = upper(p_key) and f.close > 0),
  r as (select td, c / nullif(lag(c) over (order by td), 0) - 1 as g from d)
  select extract(isodow from r.td)::int, count(r.g), count(*) filter (where r.g > 0), count(*) filter (where r.g < 0), round(avg(r.g) * 100, 3)
  from r where r.g is not null and extract(isodow from r.td) between 1 and 5 group by 1 order by 1;
end $$;

revoke all on function public.seasonality(text, text), public.seasonality_dow(text, text) from public;
grant execute on function public.seasonality(text, text), public.seasonality_dow(text, text) to anon, authenticated;
comment on function public.seasonality(text, text) is 'Perubahan persen bulanan per tahun untuk heatmap seasonality.';
