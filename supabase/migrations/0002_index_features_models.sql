-- 0002: komposisi indeks berversi, tabel fitur, model
create table public.index_versions (
  id uuid primary key default gen_random_uuid(),
  index_code text not null references public.dim_index(code),
  version_no int not null default 1,
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('active','superseded')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (index_code, effective_from, version_no),
  check (effective_to is null or effective_to >= effective_from)
);
create index index_versions_lookup_idx on public.index_versions (index_code, effective_from desc, version_no desc);

create table public.index_members (
  version_id uuid not null references public.index_versions(id) on delete cascade,
  stock_code text not null references public.dim_stock(code),
  primary key (version_id, stock_code)
);
create index index_members_stock_idx on public.index_members (stock_code);

create table public.index_changes (
  id bigint generated always as identity primary key,
  index_code text not null references public.dim_index(code),
  stock_code text not null references public.dim_stock(code),
  change_type text not null check (change_type in ('in','out')),
  effective_date date not null,
  version_id uuid not null references public.index_versions(id) on delete cascade,
  superseded boolean not null default false
);
create index index_changes_idx on public.index_changes (index_code, effective_date desc);

-- anggota indeks yang berlaku pada tanggal tertentu (versi terbaru dengan effective_from <= tanggal)
create or replace function public.index_members_on(p_index text, p_date date)
returns table (stock_code text) language sql stable security definer set search_path = '' as $$
  select m.stock_code from public.index_members m
  where m.version_id = (
    select v.id from public.index_versions v
    where v.index_code = p_index and v.effective_from <= p_date
    order by v.effective_from desc, v.version_no desc limit 1);
$$;

-- pratinjau selisih terhadap versi aktif sebelum tanggal berlaku
create or replace function public.preview_index_diff(p_index text, p_codes text[], p_date date)
returns table (stock_code text, change_type text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  return query
  with prev as (select m.stock_code from public.index_members m where m.version_id = (
      select v.id from public.index_versions v where v.index_code = p_index and v.effective_from < p_date
      order by v.effective_from desc, v.version_no desc limit 1)),
  newc as (select distinct upper(trim(c)) as code from unnest(p_codes) c where trim(c) <> '')
  select n.code, 'in'::text from newc n where n.code not in (select p.stock_code from prev p)
  union all select p.stock_code, 'out'::text from prev p where p.stock_code not in (select code from newc)
  union all select n.code, 'same'::text from newc n where n.code in (select p.stock_code from prev p);
end $$;

-- terbitkan versi baru (tidak menimpa versi lama)
create or replace function public.publish_index_version(p_index text, p_date date, p_codes text[], p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare vid uuid; vno int; codes text[]; missing text[]; prev_id uuid;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  select array_agg(distinct upper(trim(c))) into codes from unnest(p_codes) c where trim(c) <> '';
  if codes is null or array_length(codes,1) = 0 then raise exception 'Daftar saham kosong'; end if;
  select array_agg(c) into missing from unnest(codes) c where c not in (select code from public.dim_stock);
  if missing is not null then raise exception 'Kode saham tidak dikenal: %', array_to_string(missing, ', '); end if;
  select coalesce(max(version_no),0)+1 into vno from public.index_versions where index_code = p_index and effective_from = p_date;
  -- versi pembanding: versi terakhir sebelum tanggal berlaku
  select id into prev_id from public.index_versions where index_code = p_index and effective_from < p_date
    order by effective_from desc, version_no desc limit 1;
  insert into public.index_versions (index_code, version_no, effective_from, note, created_by)
  values (p_index, vno, p_date, p_note, (select auth.uid())) returning id into vid;
  insert into public.index_members (version_id, stock_code) select vid, unnest(codes);
  -- koreksi pada tanggal sama: tandai perubahan lama
  update public.index_changes set superseded = true where index_code = p_index and effective_date = p_date and not superseded;
  update public.index_versions set status = 'superseded', effective_to = p_date
    where index_code = p_index and effective_from = p_date and id <> vid;
  if prev_id is not null then
    update public.index_versions set effective_to = p_date, status = 'superseded'
      where id = prev_id and (effective_to is null or effective_to > p_date);
    insert into public.index_changes (index_code, stock_code, change_type, effective_date, version_id)
      select p_index, c, 'in', p_date, vid from unnest(codes) c where c not in (select stock_code from public.index_members where version_id = prev_id)
      union all
      select p_index, m.stock_code, 'out', p_date, vid from public.index_members m where m.version_id = prev_id and m.stock_code <> all (codes);
  else
    insert into public.index_changes (index_code, stock_code, change_type, effective_date, version_id)
      select p_index, c, 'in', p_date, vid from unnest(codes) c;
  end if;
  insert into public.audit_log (actor, action, table_name, record_key, new_data, reason)
  values ((select auth.uid()), 'PUBLISH_INDEX', 'index_versions', vid::text,
    jsonb_build_object('index', p_index, 'effective_from', p_date, 'members', array_length(codes,1)), p_note);
  return vid;
end $$;

-- ===== katalog & fitur =====
create table public.ind_catalog (
  indicator_id text primary key,
  grp text not null,
  kind text not null check (kind in ('broker','market')),
  entity text not null,
  metric text
);
create index ind_catalog_grp_idx on public.ind_catalog (grp);

create table public.feat_indicator_state (
  indicator_id text primary key references public.ind_catalog(indicator_id),
  n int not null default 0, s_sum int not null default 0,
  n0 int not null default 0, s0_sum int not null default 0,
  nc int not null default 0, sx float8 not null default 0, sy float8 not null default 0,
  sxx float8 not null default 0, syy float8 not null default 0, sxy float8 not null default 0,
  share_sum float8 not null default 0, share_n int not null default 0,
  last_val float8, last_dir smallint, last_x float8, last_date date
);

create table public.feat_indicator_daily (
  trade_date date not null,
  indicator_id text not null references public.ind_catalog(indicator_id),
  direction smallint not null,
  p float8 not null, z float8 not null, corr float8, mass float8 not null, score float8 not null,
  primary key (trade_date, indicator_id)
);
create index feat_indicator_daily_ind_idx on public.feat_indicator_daily (indicator_id, trade_date);

create table public.feat_group_score (
  trade_date date not null,
  grp text not null,
  score float8 not null check (score between -1.000001 and 1.000001),
  n_active int not null default 0,
  primary key (trade_date, grp)
);

create table public.feat_breadth (
  trade_date date primary key,
  advancers int not null, decliners int not null, unchanged int not null,
  pct_above_ma20 float8, net_foreign numeric(24,0), value_up_ratio float8, total_value numeric(24,0)
);

create table public.feat_seasonality (
  trade_date date primary key,
  target_date date not null,
  dow_avg float8, wom_avg float8, month_avg float8, yearend_avg float8
);

create table public.feat_stock_state (
  stock_code text not null, metric text not null,
  n int not null default 0, s_sum int not null default 0,
  last_val float8, last_dir smallint, last_date date,
  primary key (stock_code, metric)
);

create table public.stock_scores (
  trade_date date not null, stock_code text not null,
  score float8 not null check (score between -1.000001 and 1.000001),
  n_active smallint not null default 0,
  primary key (stock_code, trade_date)
);
create index stock_scores_date_idx on public.stock_scores (trade_date desc, score desc);

create table public.stock_score_components (
  trade_date date not null, stock_code text not null, metric text not null,
  direction smallint not null, p float8 not null, z float8 not null, score float8 not null,
  primary key (stock_code, trade_date, metric)
);
create index stock_score_components_date_idx on public.stock_score_components (trade_date);

-- ===== model =====
create table public.model_versions (
  id text primary key, description text, features text[] not null,
  active boolean not null default false, created_at timestamptz not null default now()
);
create table public.model_fits (
  id bigint generated always as identity primary key,
  model_id text not null references public.model_versions(id),
  fit_date date not null, lambda float8 not null, intercept float8 not null,
  coefs jsonb not null, means jsonb not null, stds jsonb not null, n_train int not null,
  created_at timestamptz not null default now(),
  unique (model_id, fit_date)
);
create table public.forecasts (
  id bigint generated always as identity primary key,
  model_id text not null references public.model_versions(id),
  made_on date not null, target_date date not null,
  pred_return float8 not null,
  direction text not null check (direction in ('naik','turun','netral')),
  confidence float8 not null check (confidence between 0 and 1),
  neutral_band float8 not null,
  reasons jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (model_id, made_on)
);
create or replace function public.forbid_change() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Tabel % tidak boleh diubah atau dihapus (audit)', tg_table_name; end $$;
create trigger forecasts_immutable before update or delete on public.forecasts for each row execute function public.forbid_change();

create table public.evaluations (
  model_id text not null references public.model_versions(id),
  made_on date not null, target_date date not null,
  pred_return float8 not null, actual_return float8 not null,
  pred_dir text not null, hit boolean, baseline_up_hit boolean not null,
  primary key (model_id, made_on)
);
