# Rivo Admin Audit — Stabilization Branch

Branch: `admin-full-audit-optimization`
Base: `main`

## Changes applied in this branch

- Admin session restoration now validates the current Supabase Auth user and matching `admin_users` record before rendering the panel.
- Invalid, missing, or non-super-admin authorization records are signed out and the cached authorization snapshot is cleared.
- Logout now calls Supabase Auth sign-out before clearing the local authorization snapshot.
- Removed debug logging that exposed authenticated user and admin record details.
- Removed automatic deletion of closed support tickets. Support history is retained unless an authorized administrator explicitly deletes a ticket.
- Support sidebar badge now uses exact-count head-only queries rather than fetching ticket IDs into the browser.
- Refund resolution-time metric now displays an em dash when there are no resolved claims instead of inventing a 1.2-hour metric.
- CI now runs TypeScript validation and the Vite production build.
- Removed Supabase URL debug logging.

## Still requires verification

These items cannot be safely declared fixed without checking the live Supabase schema, RLS policies, and real transactional behavior:

1. Verify RLS policies prevent non-admin authenticated users from reading or mutating administrative data. Client-side role checks are not a security boundary.
2. Confirm the exact status vocabulary used by customer, vendor, and rider support tables.
3. Reconcile Dashboard revenue with Refunds and Settlements, including partial refunds, full refunds, COD, UPI, and settlement states.
4. Confirm the active-subscription rule and the actual status/date columns before changing subscription distribution calculations.
5. Verify all Settings reads/writes against the deployed `platform_settings` columns. Do not guess between legacy `key/value` and `setting_key/setting_value`.
6. Manually test Vendors, Riders, Pickers, Customers, Orders, Settlements, Refunds, Support, Feedback, SOS, Request Center, Subscriptions, Notifications, Analytics, and Settings against the real project.
7. Verify Cloudflare Pages build settings and whether tracked `dist/` output is intentionally required.

## Validation status

GitHub source edits are committed. A local TypeScript check, production build, browser test, and live Supabase test have not yet been run from this remote-only session.
