-- Rivo support conversation schema.
-- This migration is intentionally idempotent because the schema may already exist
-- in the connected Supabase project.

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  sender_type text not null check (sender_type in ('customer', 'vendor', 'rider', 'admin')),
  sender_id uuid null,
  message text not null check (length(trim(message)) > 0),
  attachment_url text null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticket
  on public.support_ticket_messages(ticket_id, created_at);

alter table public.customer_support_tickets
  add column if not exists last_message_at timestamptz;
alter table public.customer_support_tickets
  add column if not exists unread_for_admin boolean not null default true;
alter table public.customer_support_tickets
  add column if not exists unread_for_customer boolean not null default false;

alter table public.vendor_support_tickets
  add column if not exists last_message_at timestamptz;
alter table public.vendor_support_tickets
  add column if not exists unread_for_admin boolean not null default true;
alter table public.vendor_support_tickets
  add column if not exists unread_for_vendor boolean not null default false;

alter table public.rider_support_tickets
  add column if not exists last_message_at timestamptz;
alter table public.rider_support_tickets
  add column if not exists unread_for_admin boolean not null default true;
alter table public.rider_support_tickets
  add column if not exists unread_for_rider boolean not null default false;

-- The Admin panel is the only client currently writing conversation messages.
-- User-facing policies can be added when the Customer/Vendor/Rider apps are
-- migrated to the shared conversation stream.
alter table public.support_ticket_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'support_ticket_messages'
      and policyname = 'Super admins manage support messages'
  ) then
    create policy "Super admins manage support messages"
      on public.support_ticket_messages
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.admin_users
          where admin_users.auth_user_id = auth.uid()
            and admin_users.role = 'super_admin'
        )
      )
      with check (
        exists (
          select 1
          from public.admin_users
          where admin_users.auth_user_id = auth.uid()
            and admin_users.role = 'super_admin'
        )
      );
  end if;
end
$$;
