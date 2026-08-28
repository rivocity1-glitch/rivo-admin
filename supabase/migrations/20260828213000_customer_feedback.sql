create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  category text,
  status text not null default 'unread' check (status in ('unread','read','solved','thanked')),
  admin_reply text,
  read_at timestamptz,
  solved_at timestamptz,
  thanked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_feedback_status_idx on public.customer_feedback(status);
create index if not exists customer_feedback_created_at_idx on public.customer_feedback(created_at desc);
create index if not exists customer_feedback_customer_id_idx on public.customer_feedback(customer_id);

alter table public.customer_feedback enable row level security;

create policy if not exists "Customers can create feedback"
  on public.customer_feedback for insert to authenticated
  with check (
    customer_id is not null and exists (
      select 1 from public.customers c
      where c.id = customer_feedback.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy if not exists "Customers can read own feedback"
  on public.customer_feedback for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_feedback.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy if not exists "Super admins manage customer feedback"
  on public.customer_feedback for all to authenticated
  using (
    exists (
      select 1 from public.admin_users a
      where a.auth_user_id = auth.uid()
        and a.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
      where a.auth_user_id = auth.uid()
        and a.role = 'super_admin'
    )
  );

create or replace function public.set_customer_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_feedback_updated_at on public.customer_feedback;
create trigger customer_feedback_updated_at
before update on public.customer_feedback
for each row execute function public.set_customer_feedback_updated_at();
