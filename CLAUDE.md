# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run build    # static export to /out (production uses output: "export")
npm run lint     # ESLint via next lint
```

No test suite exists. Verify changes by running the dev server and exercising the UI.

## Architecture

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (auth + DB + storage) · deployed as static export on Cloudflare Pages.

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
- `DesignerSetupCard` — checklist card rendered on dashboard when `!complete`
- `AddFontGate` — blocks `/designer/add` if `!hasSlug`

### Database

Types live in `src/lib/database.types.ts`. Migrations in `supabase/migrations/` (numbered `0001_` … `0031_` currently). Apply via `supabase db push` or Supabase MCP `apply_migration`.

Key tables: `fonts`, `users` (extended with `designer_slug`, `bank` jsonb, `entity_type`, `tax_id`, `address`, `phone`, `business_name`), `quotes`, `licenses`.

### Font pipeline

`src/lib/font-pipeline.ts` — in-browser Pyodide-based pipeline that obfuscates font files. Runs entirely client-side; no server processing.

### Storage

`src/lib/storage.ts` wraps Supabase Storage buckets. Font files (full, demo, free, obfuscated, specimen) and cover/preview images each live in separate buckets with RLS policies.

### Design tokens (Tailwind)

Colors defined in `tailwind.config.ts`: `navy` (primary), `mint` (accent/success), `bg` (page background), `border`. Use these instead of raw hex values.

### Admin vs Designer forms

`src/components/admin/FontForm.tsx` — used by admin to add/edit any font. The designer `/add` page is a lighter version for designer self-serve. Both ultimately upsert into the `fonts` table with `owner_id`.
