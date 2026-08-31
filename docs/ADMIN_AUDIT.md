# Rivo Admin Production Audit

This branch is a stabilization pass. `main` remains unchanged.

## Verified fixes

- Customer, vendor and rider support data are handled by the unified Support Desk.
- Customer feedback is handled by the unified Feedback page.
- Subscription dashboard no longer depends on the legacy `platform_settings.setting_key/setting_value` shape. It reads the actual `subscriptions.vendor_id` and `subscriptions.plan_name` fields used by the current application.
- Subscription loading now has explicit error state and refresh behavior.
- Duplicate subscription rows for the same vendor/plan are not counted twice.
- A repository validation workflow now runs TypeScript validation and the production Vite build on the stabilization branch and pull requests to `main`.

## High-priority findings for the next local test pass

1. **Refunds**: the current UI contains a synthetic `1.2 hrs` fallback when there is no resolved claim data. Production UI should display `—` instead of invented performance data.
2. **Support retention**: the current Support page contains automatic deletion of closed tickets older than seven days. This should be removed before production so support history is not silently destroyed.
3. **Support badge**: the root admin shell currently calculates its badge from the legacy `support_tickets` table while the Support Desk reads `customer_support_tickets`, `vendor_support_tickets`, and `rider_support_tickets`. These should use the same source of truth.
4. **Platform settings**: the Settings page uses `platform_settings.key/value`. Any other admin page using `setting_key/setting_value` is considered a schema mismatch and should be migrated to the current shape.
5. **Email/contact values**: contact information should be centralized instead of repeated as literals across pages. The production support address must be confirmed once and then used consistently.

## Validation command

```powershell
npx tsc --noEmit
npm run build
```

Do not merge this branch until both commands pass locally and the Subscription, Refunds, Support, Feedback, Settlements and Request Center pages have been manually opened against the real Supabase project.
