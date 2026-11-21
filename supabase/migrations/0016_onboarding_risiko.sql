-- 0016: pelengkapan profil setelah daftar (halaman terpisah) dan penyimpanan hasil kuesioner risiko.

-- Simpan data lanjutan profil. NULL/kosong = tidak mengubah. Persetujuan hanya bisa diberikan (tidak bisa dicabut lewat fungsi ini).
create or replace function public.save_onboarding(p_username text, p_birth date, p_occupation text, p_income text, p_consent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Perlu login'; end if;
  if length(coalesce(p_occupation, '')) > 60 then raise exception 'Pekerjaan terlalu panjang'; end if;
  update public.profiles set
    username = coalesce(nullif(trim(p_username), ''), username),
    birth_date = coalesce(p_birth, birth_date),
    occupation = coalesce(nullif(trim(p_occupation), ''), occupation),
    income_range = coalesce(nullif(p_income, ''), income_range),
    consent_at = case when consent_at is null and coalesce(p_consent, false) then now() else consent_at end
  where id = uid;
end $$;

-- Simpan hasil kuesioner risiko. Kategori ditentukan di server dari skor: 8–16 konservatif, 17–24 moderat, 25–32 agresif.
create or replace function public.save_risk_result(p_score int)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cat text;
begin
  if uid is null then raise exception 'Perlu login'; end if;
  if p_score is null or p_score < 8 or p_score > 32 then raise exception 'Skor tidak valid'; end if;
  cat := case when p_score <= 16 then 'konservatif' when p_score <= 24 then 'moderat' else 'agresif' end;
  update public.profiles set risk_score = p_score, risk_tolerance = cat, risk_assessed_at = now() where id = uid;
  return cat;
end $$;

revoke all on function public.save_onboarding(text, date, text, text, boolean), public.save_risk_result(int) from public, anon;
grant execute on function public.save_onboarding(text, date, text, text, boolean), public.save_risk_result(int) to authenticated;
