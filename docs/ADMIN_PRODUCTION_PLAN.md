# Rivo Admin Production Stabilization Plan

Work is isolated on `admin-full-audit-optimization`. The `main` branch has not been modified.

## Completed code changes

- Validate Supabase Auth user and admin role when restoring a session.
- Sign out from Supabase on logout.
- Remove sensitive debug logging.
- Stop automatic seven-day deletion of closed support tickets.
- Use exact count queries for support sidebar badge.
- Remove fabricated default refund resolution time.
- Add TypeScript validation to CI.

## Required release gates

- [ ] Confirm admin RLS policies for every admin-accessible table and Storage bucket.
- [ ] Verify support status values and unread semantics across all three ticket tables.
- [ ] Audit dashboard calculations against refunds, order records, and settlements.
- [ ] Determine current active subscription using confirmed schema fields.
- [ ] Verify platform settings schema and save/read behavior against production.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Manually exercise every admin page using test records.
- [ ] Verify Cloudflare preview deployment.
- [ ] Review the final PR diff before merging.

No database schema migration or destructive database operation is included in this branch.
