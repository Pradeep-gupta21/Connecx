## Fixes

### 1. Currency ($ → ₹)
- `src/routes/_authenticated/campaigns.index.tsx` (line 227): budget range uses `$` — switch to `formatMoney` from `src/components/payments/Money.tsx` (INR).
- `src/components/dashboard/AdvertiserDashboardView.tsx` (line 160): spent stat uses `$` and `toLocaleString()` — switch to `formatMoney(stats.data?.spent, "INR")`.
- Sweep the codebase once more for any other hardcoded `$<number>` occurrences and replace via `formatMoney`.

### 2. Withdrawn applications — client filtering
In `src/routes/_authenticated/applications.tsx` and any advertiser-facing applications list (dashboard/campaign detail):
- For the advertiser view, exclude rows where `status = 'withdrawn'` from Pending/active lists. Keep them only in a "history" section labeled "Withdrawn by Creator" with all action controls disabled.
- Disable the status `<Select>` and any Accept/Reject/Shortlist/Hire/Contract/Message buttons when `status === 'withdrawn'`.
- Same treatment on `src/routes/_authenticated/campaigns.$id.tsx` if it renders applications.

### 3. Backend protection (DB migration)
Add a guard so no one — advertiser or creator — can transition a `withdrawn` application to another status, and block dependent writes:

- Trigger `guard_application_withdrawn_lock` on `public.applications` BEFORE UPDATE: if `OLD.status = 'withdrawn'` and `NEW.status <> 'withdrawn'`, raise exception. Also stamp `withdrawn_at = now()` when transitioning into `withdrawn`.
- Add column `withdrawn_at timestamptz` to `applications`.
- Trigger on `public.contracts` BEFORE INSERT: if the linked `application_id` (or campaign+creator pair) has `status = 'withdrawn'`, raise exception.
- Tighten RLS UPDATE policy on `applications` so advertisers can only update rows where current `status <> 'withdrawn'`.

### 4. Realtime
The applications page already subscribes to `postgres_changes` on `applications`. Verify the advertiser dashboard counters (`AdvertiserDashboardView`) also invalidate on the same channel; if not, add a lightweight subscription that invalidates the relevant queries when an application row changes.

### 5. Password visibility toggle
Create `src/components/ui/password-input.tsx` — an `Input` wrapper with an inline `Eye`/`EyeOff` button (aria-label "Show/Hide password", `tabIndex={-1}`, does not submit forms). Swap the four `<Input type="password" .../>` occurrences in:
- `src/routes/auth.tsx` (sign-in + sign-up)
- `src/routes/auth.reset-password.tsx` (new password + confirm)

### 6. Audit
After edits, re-run the searches for `$[0-9]`, `type="password"`, and grep advertiser application UIs for stray Accept/Reject buttons on withdrawn rows.

### Non-goals
- No changes to Razorpay flow, wallet math, or unrelated business logic.
- Existing localStorage keys / event names untouched.