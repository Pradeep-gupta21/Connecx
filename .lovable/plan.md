# BrandBridge — Build Plan

A two-sided marketplace connecting advertisers with creators. Production-ready MVP, premium handcrafted UI, external Supabase backend.

## 1. Design first (3 directions)

Before any code, I'll render 3 distinct design directions — all locked to your palette/fonts:

- Fonts: Inter (body) + Manrope (display), loaded via `@fontsource`
- Primary `#111827`, Accent `#4F46E5`, Secondary `#F5F7FA`
- Light + dark mode, large whitespace, soft shadows, rounded corners
- No rainbow gradients, no excessive blue, no generic AI dashboard look

The 3 directions will vary composition/density/motion register (e.g. editorial-quiet à la Linear, dense command-center à la Raycast/Vercel, warm-marketplace à la Airbnb-meets-Notion). You pick one, I build it across every surface.

## 2. Connecting your external Supabase

You'll provide three values via the secrets form after plan approval:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for admin tasks)

I'll wire a typed Supabase client, set up Auth (email/password + Google), and run all schema as SQL migrations you can copy into your Supabase SQL editor (or I'll run via the service role).

## 3. Data model (Postgres + RLS)

```text
profiles            (id=auth.uid, display_name, avatar_url, bio, location, active_role)
user_roles          (user_id, role enum: advertiser | creator)  -- users can hold both
creator_profiles    (user_id, headline, categories[], rate_min, rate_max, socials jsonb, portfolio_media[])
advertiser_profiles (user_id, brand_name, website, industry, logo_url)
campaigns           (id, advertiser_id, title, brief, budget_min, budget_max, category, status, deadline)
applications        (id, campaign_id, creator_id, pitch, status: pending|accepted|rejected, created_at)
conversations       (id, campaign_id nullable, advertiser_id, creator_id) UNIQUE pair
messages            (id, conversation_id, sender_id, body, read_at, created_at)
notifications       (id, user_id, type, payload jsonb, read_at)
```

Roles live in `user_roles` with a `has_role(uid, role)` SECURITY DEFINER function (never on profiles). RLS on every table; explicit GRANTs to `authenticated` (and `anon` only for public creator discovery columns). A trigger auto-creates `profiles` on signup.

Storage buckets: `avatars` (public read), `portfolios` (public read), `brand-logos` (public read), `message-attachments` (signed URLs).

Realtime: enabled on `messages`, `applications`, `notifications`.

## 4. App surfaces (v1 scope)

- **Auth + onboarding** — email/password, Google OAuth, role picker (can enable both), profile setup wizard
- **Workspace switcher** — top-nav toggle between Advertiser / Creator workspaces for dual-role users
- **Creator discovery** — searchable/filterable grid (category, rate, location), public creator profile pages with portfolio gallery
- **Campaigns** — advertiser creates/edits/closes campaigns; creators browse open campaigns and apply with a pitch; advertiser reviews applications and accepts/rejects
- **Realtime messaging** — 1:1 threads (optionally scoped to a campaign), unread counts, typing-free but live message delivery via Supabase Realtime
- **Dashboards** — role-specific home: stats (active campaigns, applications, unread messages, profile views), recent activity, charts (applications over time, campaign performance) via Recharts
- **Notifications** — bell menu, realtime updates, mark-as-read
- **Settings** — account, profile, role management, sign out

## 5. Design system (componentized)

Built on shadcn/ui, restyled to the brand. Every primitive lives in `src/components/ui/*` and gets used everywhere — no one-off styles:

Buttons (5 variants + sizes), Cards (default/elevated/glass), Inputs, Textareas, Selects, Dropdowns, Comboboxes, Badges (status + category), Avatars (+ stacks), Dialogs/Modals, Sheets, Drawers, Tabs, Tables (sortable, with empty states), Sidebar nav, Top nav with command palette (⌘K via `cmdk`), Toasts (sonner), Notification popover, Charts (Recharts wrappers), Empty states, Error states, Skeleton loaders, Keyboard shortcut hints.

Micro-interactions via `framer-motion` (fade/scale on mount, hover-lift on cards, page transitions). Dark/light toggle persisted.

## 6. Stack & routing

You asked for React Router, but this project's template is **TanStack Start** (file-based routing in `src/routes/`, SSR-capable). I'll use TanStack Router throughout — the developer ergonomics and type safety are equivalent/better than React Router DOM, and switching frameworks would break the template. If you'd prefer a pure React Router SPA, say so and I'll restructure.

- TypeScript strict, Tailwind v4, shadcn/ui, TanStack Query for all data, Supabase JS client, Recharts, framer-motion, cmdk, sonner, zod + react-hook-form.

## 7. Route map

```text
/                       marketing landing (logged-out)
/auth                   sign in / sign up / Google
/onboarding             role picker + profile setup
/_authenticated/
  /dashboard            role-aware home
  /discover             creator search/grid
  /creators/$id         public creator profile
  /campaigns            list (role-aware: mine vs open)
  /campaigns/new        advertiser-only
  /campaigns/$id        detail + applications panel
  /messages             inbox
  /messages/$threadId   thread (realtime)
  /notifications        list
  /settings             account/profile/roles
```

## 8. Delivery order

1. Install deps, fonts, Tailwind tokens, dark mode, design system primitives
2. Render 3 design directions → you pick one
3. External Supabase wiring + SQL migrations (you'll paste keys via secret form)
4. Auth + onboarding + role model
5. Profiles (creator + advertiser) + Storage uploads
6. Campaigns + applications
7. Discovery + public creator pages
8. Realtime messaging
9. Dashboards + notifications + command palette
10. Empty/error/skeleton states pass + polish pass

## Technical notes

- **External Supabase, not Lovable Cloud**: I won't call `supabase--enable`. You'll add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` via the secrets form. I'll generate a hand-rolled `src/integrations/supabase/client.ts` (no template integration) and emit `.sql` migration files you can run, plus an admin client behind `*.server.ts` for the few server-side admin tasks.
- **RLS**: every table RLS-enabled, policies use `auth.uid()` and the `has_role()` SECURITY DEFINER function; `GRANT`s issued alongside each `CREATE TABLE`.
- **Realtime**: Supabase Realtime channels for `messages` (per conversation) and `notifications` (per user); TanStack Query cache invalidation on events.
- **Storage**: signed-URL uploads from the browser using the publishable key + RLS-protected `storage.objects` policies.
- **No `src/server/`**: server-only helpers go in `*.server.ts`; server functions in `src/lib/*.functions.ts`.
- **Confirm before I start**: external Supabase means no Lovable-managed `_authenticated/route.tsx` auto-gate — I'll author the auth gate manually with `supabase.auth.getUser()`, `ssr: false`.
