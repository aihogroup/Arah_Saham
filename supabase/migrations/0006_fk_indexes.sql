-- Indeks untuk foreign key yang belum tercakup (saran advisor performa).
create index if not exists blog_posts_author_idx on public.blog_posts (author_id);
create index if not exists index_changes_stock_idx on public.index_changes (stock_code);
create index if not exists index_changes_version_idx on public.index_changes (version_id);
create index if not exists orders_plan_idx on public.orders (plan_id);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create index if not exists watchlists_stock_idx on public.watchlists (stock_code);
