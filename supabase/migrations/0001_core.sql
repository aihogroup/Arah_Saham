-- 0001_core: ekstensi, fungsi bantu, referensi, akun, langganan, fakta pasar, operasional, konten
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ===== fungsi bantu =====
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ===== referensi =====
create table public.dim_stock (
  code text primary key check (code ~ '^[A-Z0-9]{2,8}$'),
  name text not null,
  sector text,
  board text,
  listed_shares bigint check (listed_shares is null or listed_shares >= 0),
  active boolean not null default true,
  source text not null default 'admin',
  updated_at timestamptz not null default now()
);
create index dim_stock_name_trgm on public.dim_stock using gin (name extensions.gin_trgm_ops);
create index dim_stock_sector_idx on public.dim_stock (sector);
create trigger dim_stock_touch before update on public.dim_stock for each row execute function public.touch_updated_at();

create table public.dim_broker (
  code text primary key check (code ~ '^[A-Z0-9]{2,4}$'),
  name text not null,
  active boolean not null default true
);

create table public.dim_index (
  code text primary key,
  name text not null,
  description text,
  is_benchmark boolean not null default false,
  sort_order int not null default 100
);

create table public.dim_market_symbol (
  symbol text primary key,
  name text not null,
  category text not null check (category in ('komoditas','kurs','indeks_global','proksi_id')),
  usable_d1 boolean not null default true,
  active boolean not null default true
);

create table public.dim_date (
  date date primary key,
  is_trading_day boolean not null,
  dow smallint not null,
  week_of_month smallint not null,
  month smallint not null,
  year smallint not null,
  is_year_end boolean not null
);
insert into public.dim_date
select d::date, extract(isodow from d) < 6, extract(isodow from d), ((extract(day from d)::int - 1) / 7) + 1,
       extract(month from d), extract(year from d), (extract(month from d) = 12 and extract(day from d) >= 20)
from generate_series('2020-01-01'::date, '2032-12-31'::date, interval '1 day') d;

-- ===== akun =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  birth_date date,
  occupation text,
  income_range text check (income_range is null or income_range in ('<5jt','5-10jt','10-25jt','25-50jt','>50jt')),
  risk_tolerance text check (risk_tolerance is null or risk_tolerance in ('konservatif','moderat','agresif')),
  daily_loss_limit_pct numeric(4,1) check (daily_loss_limit_pct is null or daily_loss_limit_pct between 0.5 and 20),
  experience_years smallint check (experience_years is null or experience_years between 0 and 60),
  trading_style text check (trading_style is null or trading_style in ('scalping','intraday','swing_singkat')),
  capital_range text,
  active_hours text,
  fav_indexes text[] not null default '{}',
  fav_sectors text[] not null default '{}',
  fav_indicators text[] not null default '{}',
  consent_at timestamptz,
  trial_used boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','user')),
  primary key (user_id, role)
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;

create table public.user_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  universe text[] not null default '{}',
  indicators text[] not null default '{}',
  risk text not null default 'moderat' check (risk in ('konservatif','moderat','agresif')),
  email_digest boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index user_presets_user_idx on public.user_presets (user_id);

create table public.watchlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_code text not null references public.dim_stock(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stock_code)
);

-- pendaftaran: salin metadata ke profil, validasi umur >= 17
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); bd date;
begin
  begin bd := nullif(m->>'birth_date','')::date; exception when others then bd := null; end;
  if bd is not null and bd > (current_date - interval '17 years') then
    raise exception 'Usia minimal 17 tahun';
  end if;
  insert into public.profiles (id, username, birth_date, occupation, income_range, risk_tolerance, daily_loss_limit_pct, consent_at)
  values (new.id,
    coalesce(nullif(m->>'username',''), 'user_' || substr(replace(new.id::text,'-',''),1,10)),
    bd, nullif(m->>'occupation',''), nullif(m->>'income_range',''), nullif(m->>'risk_tolerance',''),
    nullif(m->>'daily_loss_limit_pct','')::numeric,
    case when (m->>'consent') = 'true' then now() end);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== langganan & pembayaran =====
create table public.plans (
  id text primary key,
  name text not null,
  price_idr integer not null check (price_idr >= 0),
  duration_days integer not null check (duration_days > 0),
  active boolean not null default true,
  sort_order int not null default 100
);
insert into public.plans (id, name, price_idr, duration_days, sort_order) values
 ('premium_monthly','Premium Bulanan',79000,30,1),
 ('premium_yearly','Premium Tahunan',790000,365,2);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text references public.plans(id),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  source text not null check (source in ('trial','midtrans','manual')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  order_id text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index subscriptions_user_active_idx on public.subscriptions (user_id, ends_at desc);

create table public.orders (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  gross_amount integer not null check (gross_amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','cancelled','refunded')),
  snap_token text,
  payment_type text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.payment_events (
  id bigint generated always as identity primary key,
  order_id text not null,
  transaction_status text not null,
  status_code text,
  fraud_status text,
  gross_amount text,
  signature_ok boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (order_id, transaction_status, status_code)
);

create or replace function public.is_premium() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.subscriptions
    where user_id = (select auth.uid()) and status = 'active' and starts_at <= now() and ends_at > now());
$$;

-- percobaan 30 hari, sekali per akun
create or replace function public.start_trial() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Perlu login'; end if;
  update public.profiles set trial_used = true where id = uid and trial_used = false and consent_at is not null;
  if not found then return false; end if;
  insert into public.subscriptions (user_id, plan_id, source, ends_at) values (uid, null, 'trial', now() + interval '30 days');
  return true;
end $$;

-- ===== fakta pasar =====
create table public.fact_stock_daily (
  stock_code text not null,
  trade_date date not null,
  prev_close numeric(18,2), open_price numeric(18,2), high numeric(18,2), low numeric(18,2),
  close numeric(18,2) not null check (close >= 0),
  change numeric(18,2), change_pct numeric(9,4),
  volume bigint not null default 0 check (volume >= 0),
  value numeric(22,0) not null default 0 check (value >= 0),
  frequency bigint not null default 0 check (frequency >= 0),
  bid numeric(18,2), offer numeric(18,2),
  foreign_buy numeric(22,0) not null default 0, foreign_sell numeric(22,0) not null default 0,
  listed_shares bigint,
  source text not null default 'idx',
  ingested_at timestamptz not null default now(),
  primary key (stock_code, trade_date)
);
create index fact_stock_daily_date_idx on public.fact_stock_daily (trade_date desc, value desc);
create index fact_stock_daily_brin on public.fact_stock_daily using brin (trade_date);

create table public.fact_broker_daily (
  broker_code text not null,
  trade_date date not null,
  volume numeric(22,0) not null default 0 check (volume >= 0),
  value numeric(22,0) not null default 0 check (value >= 0),
  frequency bigint not null default 0 check (frequency >= 0),
  source text not null default 'idx',
  ingested_at timestamptz not null default now(),
  primary key (broker_code, trade_date)
);
create index fact_broker_daily_date_idx on public.fact_broker_daily (trade_date desc);

create table public.fact_index_daily (
  index_code text not null,
  trade_date date not null,
  prev_close numeric(18,4), open_price numeric(18,4), high numeric(18,4), low numeric(18,4),
  close numeric(18,4) not null,
  change numeric(18,4), change_pct numeric(9,4),
  volume numeric(22,0), value numeric(22,0), frequency bigint, market_cap numeric(24,0),
  source text not null default 'idx',
  ingested_at timestamptz not null default now(),
  primary key (index_code, trade_date)
);
create index fact_index_daily_date_idx on public.fact_index_daily (trade_date desc);

create table public.fact_market_daily (
  symbol text not null references public.dim_market_symbol(symbol),
  trade_date date not null,
  close numeric(20,6) not null check (close > 0),
  volume numeric(22,0),
  source text not null default 'yahoo',
  ingested_at timestamptz not null default now(),
  primary key (symbol, trade_date)
);
create index fact_market_daily_date_idx on public.fact_market_daily (trade_date desc);

create table public.intraday_ihsg (
  ts timestamptz primary key,
  price numeric(18,4) not null
);

-- ===== operasional =====
create table public.raw_ingest (
  id bigint generated always as identity primary key,
  source text not null,
  trade_date date,
  payload jsonb not null,
  payload_hash text not null,
  fetched_at timestamptz not null default now(),
  unique (source, trade_date, payload_hash)
);
create index raw_ingest_source_date_idx on public.raw_ingest (source, trade_date desc);

create table public.ingest_log (
  id bigint generated always as identity primary key,
  source text not null,
  trade_date date,
  status text not null check (status in ('ok','partial','empty','error')),
  rows_in integer not null default 0,
  rows_ok integer not null default 0,
  rows_rejected integer not null default 0,
  duration_ms integer,
  message text,
  started_at timestamptz not null default now()
);
create index ingest_log_started_idx on public.ingest_log (started_at desc);

create table public.quarantine (
  id bigint generated always as identity primary key,
  source text not null,
  trade_date date,
  reason text not null,
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);
create index quarantine_open_idx on public.quarantine (created_at desc) where not resolved;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text not null,
  record_key text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, action, table_name, record_key, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(new)->>'code'), (to_jsonb(old)->>'id'), (to_jsonb(old)->>'code')),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger dim_stock_audit after insert or update or delete on public.dim_stock for each row execute function public.audit_trigger();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions for each row execute function public.audit_trigger();
create trigger plans_audit after insert or update or delete on public.plans for each row execute function public.audit_trigger();

create table public.csv_downloads (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);

-- ===== konten =====
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  title text not null,
  excerpt text,
  body_md text not null default '',
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  publish_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_pub_idx on public.blog_posts (publish_at desc) where status = 'published';
create trigger blog_posts_touch before update on public.blog_posts for each row execute function public.touch_updated_at();
create trigger blog_posts_audit after insert or update or delete on public.blog_posts for each row execute function public.audit_trigger();

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info' check (level in ('info','warning','critical')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create trigger announcements_audit after insert or update or delete on public.announcements for each row execute function public.audit_trigger();
