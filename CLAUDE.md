# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run build    # static export to /out (production uses output: "export")
npm run lint     # ESLint (flat config: eslint.config.mjs)
```

No test suite exists. Verify changes by running the dev server and exercising the UI.

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (auth + DB + storage) · deployed as static export on Cloudflare Pages.

**Critical constraint:** `next.config.ts` sets `output: "export"` in production. This means **no server-side runtime** — no `getServerSideProps`, no API Routes that need Node.js at runtime (the `/api/send-email` route only runs in dev), no middleware. All data fetching is client-side via Supabase JS SDK.

### Auth & roles

`src/context/AuthContext.tsx` provides `{ user, role, loading }` globally. Roles come from `supabase.rpc("get_my_role")` — values are `"admin" | "designer" | "customer"`. Role checks happen in layout files, not middleware.

### Route structure

```
src/app/
  (public)          fonts/, designer/[designer]/, page.tsx, etc.
  auth/             login, signup
  account/          customer profile
  designer/
    (dashboard)/    layout.tsx guards role === "designer" | "admin"
      page.tsx      font list
      add/          AddFontGate wraps children — blocks if no slug
      settings/     all seller info in one page (slug, seller info, bank)
      quotes/  pricing/  revenue/
    [designer]/     public designer storefront
  admin/            layout.tsx guards role === "admin"
    add/  font-review/  pricing/  quotes/  revenue/  settings/  designers/
```

### Designer setup state

`src/components/designer/SetupGate.tsx` exports:
- `useDesignerSetup()` — reads `users` table, returns `{ hasSlug, hasSellerInfo, hasBank, complete }`
- `AddFontGate` — blocks `/designer/add` if `!hasSlug`

When `!complete`, `src/app/designer/(dashboard)/layout.tsx` redirects to `/designer/onboarding`.

### Database

Types live in `src/lib/database.types.ts`. Migrations in `supabase/migrations/` (numbered `0001_` … `0074_` currently).

**Apply with Supabase MCP `apply_migration` only — never `supabase db push`.** The remote
`schema_migrations` table records versions as timestamps (`20260731174441` = `payout_wht`),
while the repo names files by sequence (`0073_payout_wht.sql`). They are the same migrations,
but the CLI matches on version, sees ~45 remote entries with no local match, and refuses.

Do **not** follow the CLI's suggested fixes when that happens:
- `migration repair --status reverted …` marks migrations that are live in production as
  reverted, so the next push replays `0001_` onward over an existing schema — e.g. `0072`
  would re-run `update designer_license_config set quote_enabled = true`, silently
  re-enabling quotes for every designer who turned them off.
- `db pull` overwrites the curated migration folder with a single schema snapshot, losing
  the per-migration comments that document the traps behind each change.

Key tables: `fonts`, `users` (extended with `designer_slug`, `bank` jsonb, `entity_type`, `tax_id`, `address`, `phone`, `business_name`), `quotes`, `licenses`.

### Documents (quotation / invoice / receipt / payout)

All PDFs come from **one renderer**. `src/lib/doc-layout.ts` owns geometry, Thai line
breaking, and the top-edge→baseline conversion; `quote-doc.ts` and `payout-doc.ts` only
describe *what* to draw. `PrintLightbox.tsx` previews the actual PDF in an `<iframe>` and
hands the same bytes to the email sender — never re-render a document in HTML.

Never call `page.drawText()` outside `doc-layout.ts`: pdf-lib positions text by baseline,
and treating that as a box top is what previously made emailed documents overlap.

License wording is **frozen into `quotes.fonts_detail` at issue time** (`license_lines`).
Documents already sent must not change when a designer later edits tier names or prices.

### Font pipeline

`src/lib/font-pipeline.ts` — in-browser Pyodide-based pipeline that obfuscates font files. Runs entirely client-side; no server processing.

### Storage

`src/lib/storage.ts` wraps Supabase Storage buckets. Font files (full, demo, free, obfuscated, specimen) and cover/preview images each live in separate buckets with RLS policies.

### Design tokens (Tailwind)

Colors defined in `tailwind.config.ts`: `navy` (primary), `mint` (accent/success), `bg` (page background), `border`. Use these instead of raw hex values.

### Admin vs Designer forms

`src/components/admin/FontForm.tsx` — used by admin to add/edit any font. The designer `/add` page is a lighter version for designer self-serve. Both ultimately upsert into the `fonts` table with `owner_id`.
