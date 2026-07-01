## Auth upgrade plan

Extend the current auth with signup fields (country, phone, primary role), required email verification, forgot password, role-based redirect, and a profile-completion flow. Keep the existing dual-role workspace model — signup picks the *primary* role, users can add the second role later in Settings.

### 1. Database

Migration adds two columns to `profiles`:
- `country text`
- `phone text`

No other schema changes (roles already live in `user_roles`, primary role tracked in `profiles.active_role`, `onboarded` flag already exists).

### 2. Signup form (`/auth`)

Replace current sign-up tab fields with:
- Full name
- Email
- Password (+ confirm)
- Primary role — segmented control: Creator / Advertiser
- Country — searchable select (ISO country list)
- Phone — input with country dial-code prefix based on selected country (stored E.164-ish, no SMS)

On submit:
1. `supabase.auth.signUp` with `emailRedirectTo: ${origin}/auth/callback`, metadata carries `full_name`, `role`, `country`, `phone`.
2. Show "Check your inbox" screen — do NOT navigate into the app.

Update the `handle_new_user` trigger to also copy `country`, `phone`, `active_role` from `raw_user_meta_data` into `profiles`, and insert the chosen role into `user_roles`.

### 3. Email verification (required)

- New public route `/auth/callback` — parses Supabase hash tokens, calls `setSession`, then routes based on `active_role`.
- Managed `_authenticated` gate additionally checks `user.email_confirmed_at`. If null → redirect to `/auth/verify-email` (public route showing "Verify your inbox" + "Resend email" button using `supabase.auth.resend`).
- Enable Supabase auth email templates via the email-templates scaffold so the confirmation email is branded.

### 4. Forgot password

- Link on sign-in tab → `/auth/forgot-password` (public): email input → `resetPasswordForEmail(email, { redirectTo: ${origin}/auth/reset-password })`.
- `/auth/reset-password` (public): detects `type=recovery` in URL hash, shows new-password form, calls `supabase.auth.updateUser({ password })`, then redirects to sign-in.

### 5. Role-based redirect

Add two thin layout routes:
- `src/routes/_authenticated/dashboard.creator.tsx` → `/dashboard/creator`
- `src/routes/_authenticated/dashboard.advertiser.tsx` → `/dashboard/advertiser`

Each renders the existing role-aware dashboard filtered to that role. The generic `/dashboard` becomes a redirector that sends the user to `/dashboard/<active_role>`. `WorkspaceSwitcher` navigates between the two.

Post-login/verification/callback redirect target:
```
active_role === 'advertiser' → /dashboard/advertiser
otherwise                    → /dashboard/creator
```

### 6. Profile completion flow

`onboarding.tsx` becomes the *profile completion* gate. Trigger conditions (checked in `_authenticated` layout, in order):
1. No email confirmation → `/auth/verify-email`
2. `profile.onboarded === false` → `/onboarding`
3. Missing role-specific required fields (creator: categories + rate; advertiser: brand_name + industry) → `/onboarding?step=profile`
4. Otherwise → requested route.

Onboarding is trimmed since signup now collects role/country/phone:
- Step 1: confirm/adjust display name + bio + avatar upload.
- Step 2: role-specific fields (creator categories & rate, or advertiser brand & industry).
- Sets `onboarded=true` and routes to `/dashboard/<active_role>`.

Settings gains an "Add second role" action that upserts into `user_roles` and, if missing, opens the corresponding role-specific profile form.

### 7. Route protection & session persistence

Already handled by `_authenticated/route.tsx` (Supabase persisted session + `getUser()` gate). We extend it with the email-verified + onboarded checks above. Public routes: `/`, `/auth`, `/auth/callback`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`.

Google OAuth button stays (uses `lovable.auth.signInWithOAuth`). OAuth users skip email verification but are routed through `/onboarding` because they won't have `country`/`phone`/role yet.

### 8. Technical notes

- Country list: local constant array (name + ISO2 + dial code), no external dep.
- Phone stored as `+<dial><digits>`; validated with a light regex (`^\+\d{6,15}$`).
- All new forms use `react-hook-form` + `zod` (already installed) matching existing style.
- No Edge Functions; all reads/writes go through the browser Supabase client.
- Confirmation & recovery emails: scaffold branded templates via the email-templates tool.
- Toast feedback on every auth action; loading states on every submit button.

### Files touched / added

Added: `src/routes/auth.callback.tsx`, `src/routes/auth.forgot-password.tsx`, `src/routes/auth.reset-password.tsx`, `src/routes/auth.verify-email.tsx`, `src/routes/_authenticated/dashboard.creator.tsx`, `src/routes/_authenticated/dashboard.advertiser.tsx`, `src/lib/countries.ts`.

Modified: `src/routes/auth.tsx` (new signup fields + forgot link), `src/routes/onboarding.tsx` (profile completion only), `src/routes/_authenticated/route.tsx` (verify + completion gates), `src/routes/_authenticated/dashboard.tsx` (becomes redirector), `src/components/layout/WorkspaceSwitcher.tsx` (route on switch), `src/routes/_authenticated/settings.tsx` (country/phone editing + add-second-role).

Migration: add `country`, `phone` to `profiles`; update `handle_new_user` to persist metadata + insert primary role into `user_roles`.
