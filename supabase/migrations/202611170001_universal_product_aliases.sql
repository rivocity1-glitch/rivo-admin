-- RivoCity master catalogue aliases.
-- Run this migration in Supabase before enabling the Product Catalogue admin page.
create table if not exists public.universal_product_aliases (
  id uuid primary key default gen_random_uuid(),
  universal_product_id uuid not null references public.universal_products(id) on delete cascade,
  alias text not null check (length(trim(alias)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists universal_product_aliases_alias_unique
  on public.universal_product_aliases (lower(trim(alias)));
create index if not exists universal_product_aliases_product_idx
  on public.universal_product_aliases (universal_product_id);

alter table public.universal_product_aliases enable row level security;

drop policy if exists "Authenticated users can read catalogue aliases" on public.universal_product_aliases;
create policy "Authenticated users can read catalogue aliases"
  on public.universal_product_aliases for select to authenticated using (true);

drop policy if exists "Admins can manage catalogue aliases" on public.universal_product_aliases;
create policy "Admins can manage catalogue aliases"
  on public.universal_product_aliases for all to authenticated
  using (exists (
    select 1 from public.admin_users au
    where au.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_users au
    where au.auth_user_id = auth.uid()
  ));
