-- Satu kebijakan SELECT per peran: anon hanya yang terbit; authenticated yang terbit ATAU admin (lihat draf).
drop policy ann_admin on public.announcements; drop policy ann_read on public.announcements;
create policy ann_read_anon on public.announcements for select to anon using (starts_at <= now() and (ends_at is null or ends_at > now()));
create policy ann_read_auth on public.announcements for select to authenticated using ((starts_at <= now() and (ends_at is null or ends_at > now())) or (select public.is_admin()));
create policy ann_ins on public.announcements for insert to authenticated with check ((select public.is_admin()));
create policy ann_upd on public.announcements for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ann_del on public.announcements for delete to authenticated using ((select public.is_admin()));

drop policy blog_admin on public.blog_posts; drop policy blog_read on public.blog_posts;
create policy blog_read_anon on public.blog_posts for select to anon using (status = 'published' and publish_at <= now());
create policy blog_read_auth on public.blog_posts for select to authenticated using ((status = 'published' and publish_at <= now()) or (select public.is_admin()));
create policy blog_ins on public.blog_posts for insert to authenticated with check ((select public.is_admin()));
create policy blog_upd on public.blog_posts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy blog_del on public.blog_posts for delete to authenticated using ((select public.is_admin()));
