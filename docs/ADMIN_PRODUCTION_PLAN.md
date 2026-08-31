# Rivo Admin Production Stabilization Plan

This branch is for a controlled audit before any production merge. `main` remains untouched.

## Scope

- Centralize support contact configuration.
- Use the current Supabase schema consistently.
- Remove synthetic/fallback operational metrics.
- Keep support history intact; never silently delete old support records.
- Use the same ticket tables for the Support badge and Support Desk.
- Keep Subscription, Refunds, Settlements, Request Center, Feedback and Support pages compatible with the existing database rather than inventing new tables or columns.
- Validate every change with TypeScript and a production build.

## Known schema references

- Feedback: `customer_feedback`.
- Customer support: `customer_support_tickets`.
- Vendor support: `vendor_support_tickets`.
- Rider support: `rider_support_tickets`.
- Shared support messages: `support_ticket_messages`.
- Subscriptions: `subscriptions`.
- Platform settings: current Settings page uses `platform_settings.key` and `platform_settings.value`.

## Release checklist

1. `npx tsc --noEmit`
2. `npm run build`
3. Open Dashboard.
4. Open Vendors.
5. Open Riders.
6. Open Customers.
7. Open Orders.
8. Open Settlements.
9. Open Refunds.
10. Open Support.
11. Open Feedback.
12. Open Request Center.
13. Open Subscriptions.
14. Open Notifications.
15. Open Analytics.
16. Open Settings.

Do not merge until the local application is clean against the real Supabase project.
