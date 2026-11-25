-- Mode data di Akun (profiles.forecast_mode) dan di preferensi beranda (user_invest_prefs.data_mode) selalu sama.
create or replace function public.sync_prefs_data_mode() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.forecast_mode is distinct from old.forecast_mode and new.forecast_mode in ('stabil','dinamis') then
    update public.user_invest_prefs set data_mode = new.forecast_mode, updated_at = now() where user_id = new.id and data_mode is distinct from new.forecast_mode;
  end if;
  return new;
end $$;
revoke all on function public.sync_prefs_data_mode() from public, anon, authenticated;
drop trigger if exists profiles_sync_data_mode on public.profiles;
create trigger profiles_sync_data_mode after update of forecast_mode on public.profiles for each row execute function public.sync_prefs_data_mode();
