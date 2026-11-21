-- Pembatas laju terdistribusi: satu baris per kunci, atomik, tanpa WAL (unlogged) agar murah.
create unlogged table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  n int not null default 0 check (n >= 0)
);
alter table public.rate_limits enable row level security; -- tanpa kebijakan: hanya service_role/fungsi definer
comment on table public.rate_limits is 'Penghitung pembatas laju per kunci (mis. pay:<uid>). Dibersihkan oleh hit_rate_limit.';

create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_s int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if p_key is null or length(p_key) > 120 or p_limit < 1 or p_window_s < 1 then return false; end if;
  insert into public.rate_limits as r (key, window_start, n) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_s) then now() else r.window_start end,
    n = case when r.window_start < now() - make_interval(secs => p_window_s) then 1 else r.n + 1 end
  returning n into v;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '1 day'; end if;
  return v <= p_limit;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
