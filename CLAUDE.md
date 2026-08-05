# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal fitness/exercise planner ("Fit Planner") synced across devices via Supabase (Postgres + Auth + Realtime + Edge Functions). Vanilla HTML/CSS/JS frontend, no build step, no npm dependencies — `@supabase/supabase-js` is loaded via CDN `<script>` tag (UMD build) as `window.supabase`. Sibling project to the "Gerechten" recipe app one directory up (`../`) — same architecture and conventions, entirely separate Supabase project and data.

Plans movement/sport/exercise (including back/hip/knee rehab-style exercises) into a real weekly schedule, tracks completion with a simple points & levels system, and sends real push notifications (daily "what's planned today" + weekly "go plan your week") — including on iPhone when added to the Home Screen.

## Setup (one-time, per Supabase project)

1. Create a **new, separate** free project at supabase.com (do not reuse the Gerechten project — this app needs its own tables/auth account).
2. Run `supabase-schema.sql` in the project's SQL Editor — creates `exercise_categories`, `exercises`, `sessions`, `user_settings`, `push_subscriptions`, `exercise_attachments`, the private `exercise-attachments` Storage bucket + policy, RLS policies (every row scoped to `auth.uid()`), and Realtime on every table. Leave the `pg_cron`/`pg_net` block at the bottom commented out for now — it needs the Edge Function deployed first (step 6). The whole file is idempotent (`if not exists`/`drop policy if exists`/`on conflict do nothing`), so if you already ran an earlier version, just re-run the whole file to pick up new tables/columns.
3. In Project Settings -> API, copy the Project URL and anon public key into `js/config.js` (copy `js/config.js.example` first). RLS is what actually protects data, so the anon key is safe to ship client-side.
4. In Authentication -> Sign In / Providers -> Email: enable the Email provider, and turn **"Confirm email" off** — this is a single-user access-code login (see below), not a real multi-user signup flow.
5. Generate a Web Push VAPID keypair: `npx web-push generate-vapid-keys`. Put the public key in `js/config.js` as `VAPID_PUBLIC_KEY`. Keep the private key for step 6.
6. Deploy the reminders Edge Function and set its secrets:
   ```
   supabase functions deploy send-reminders --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<any-random-string>
   ```
7. Uncomment the `pg_cron`/`pg_net` block at the bottom of `supabase-schema.sql`, fill in your project ref and the same `CRON_SECRET`, and run just that block in the SQL Editor. This schedules the Edge Function to run every 10 minutes and check whether it's time to send anyone a reminder.

### Auth model: access code, not email/password

Identical trick to the Gerechten app: the UI only ever asks for a code, no email field. Under the hood it's Supabase email+password auth against one fixed, internal account: `window.APP_ACCOUNT_EMAIL` (in `js/config.js`) is used as the email for every `signInWithPassword`/`signUp` call, and the code the user types is the password. First use: "Code instellen" calls `signUp` once; after that, "Inloggen" is used every time, on every device.

## Commands

No build/lint/test tooling. To develop, serve the directory locally:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. `localhost` is exempt from the service-worker secure-context requirement, so this is fine for everything except testing real Web Push on an iPhone — see below.

### Testing Web Push on an actual iPhone

Service workers (and therefore Web Push) require a real secure context off of `localhost`. To test on-device: deploy to any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages) or run a tunnel (`ngrok http 8000` / Cloudflare Tunnel) during development. Then, on the iPhone: open that HTTPS URL in Safari, "Share" -> "Add to Home Screen", and launch it from the Home Screen icon (Web Push does not work in a plain Safari tab, only in an installed standalone PWA, and only on iOS 16.4+).

## Architecture

- `supabase-schema.sql` — source of truth for the DB schema, RLS policies, and realtime publication (idempotent, safe to re-run). The `pg_cron`/`pg_net` block at the end is commented out by default; it's the first thing in this codebase family (vs. the Gerechten app) that schedules server-side work, and needs the Edge Function deployed and its `CRON_SECRET` known before it can be uncommented and run.
- `js/config.js` (copy from `js/config.js.example`) — Supabase URL/anon key, the access-code account email, and the public VAPID key, filled in per-deployment.
- `index.html` — `#authScreen` / `#app` toggled via `hidden`, plus `#exerciseModalOverlay` for editing an exercise's details. Inside `#app`, `.layout` holds `.sidebar` (Vandaag / Deze week / Oefeningen / Instellingen) and `.main`, which toggles between `#todayView`, `#weekView`, `#exercisesView`, `#settingsView`.
- `css/style.css` — same design tokens and breakpoints as the Gerechten app (`--bg`/`--surface`/`--accent`/etc. custom properties, dark-mode-first with a `prefers-color-scheme: light` override, sidebar horizontal-chip-row below 720px vs. a real column above it, `env(safe-area-inset-*)` for the iPhone notch/home-indicator).
- `js/app.js` — all logic in one flat file, no framework/build step:
  - `sb` is the Supabase client; all reads/writes go through it. State (`exerciseCategories`, `exercises`, `sessions`, `userSettings`, `pushSubscriptions`) is loaded in full per user into `let` globals — fine at personal scale, not designed to paginate.
  - Auth state is driven by `sb.auth.onAuthStateChange`, toggling between the auth screen and the app and (re)establishing the realtime subscription.
  - `setupRealtime()`: one Realtime channel listening for `postgres_changes` on all five tables filtered to the current user; any change just refetches + calls `renderAll()` — no client-side merge logic, no optimistic local mutation.
  - **Sessions are date-based, not template-based**: each `sessions` row has a real `scheduled_date`, so history, the points/level total, and the daily streak all fall directly out of querying that one table — there's no separate stats table.
  - **Points & levels**: completing a session (`setSessionStatus(id, "done")`) snapshots `points_awarded` from the exercise's current `points_value` (so editing an exercise's point value later doesn't retroactively rewrite history) and sets `completed_at`. `totalPoints()`/`computeLevel()`/`computeLevelProgress()`/`computeStreak()` derive everything else client-side from the loaded `sessions` array — see the "points / level / streak" section of `app.js`.
  - **Week planning**: `renderWeek()` builds 7 day cards from `weekDates()` (Monday-start, `weekOffset` weeks from the current week). Each day card has its own quick-add form (delegated `submit` listener on `#weekDays`) and a "Kopieer vorige week" button (`copyPreviousWeek()`) that duplicates last week's sessions onto the corresponding dates of the viewed week — the main lever for fast, low-friction planning.
  - **Exercise categories** (`exercise_categories`) mirror the Gerechten app's `categories` table exactly — rug/heup/knie/sport/etc. are user-created rows with a `PALETTE`-assigned color, not a hardcoded enum. The chip filter row in "Oefeningen" (`renderExerciseCategoryFilters`) is single-select (click again to clear), unlike the Gerechten app's multi-select tag filter.
  - **Exercise modal** (`openExerciseModal`/`renderExerciseModal`): opened by clicking an exercise row; every field (name, category, sets/reps/duration, points, notes, video URL) saves individually on blur/change, same as the Gerechten app's task modal — there's no separate "Save" button. Archiving is a soft toggle (`archived` boolean, exercise stays visible in the list, dimmed); the modal's delete button is a real, immediate delete (no confirmation dialog, matching the Gerechten app's convention) and also removes that exercise's Storage files first.
  - **Exercise video** (`exercises.video_url`): `parseVideoEmbed()`/`videoEmbedHtml()` best-effort embed a YouTube/Vimeo link (via `-nocookie`/`player.vimeo.com` iframes) or a direct video file link (native `<video>`); anything else falls back to a plain "open in new tab" link, since arbitrary sites usually block iframe embedding.
  - **Exercise photos** (`exercise_attachments` + the private `exercise-attachments` Storage bucket): PNG/JPG only, 10MB max (validated client-side against `ALLOWED_MIME`/`ALLOWED_EXT`/`MAX_FILE_BYTES`, same limits as the Gerechten app's attachments — the PNG/JPG restriction itself is only enforced client-side). Files live at `<user_id>/<exercise_id>/<random>-<filename>`; previews use short-lived `createSignedUrl()` URLs generated in `renderExerciseModalAttachments()`, not public URLs. Clicking a photo opens `#lightboxOverlay` (`openLightbox`/`closeLightbox`), same pattern as the Gerechten app's attachment lightbox.
  - **Push notifications**: `enablePushNotifications()` (user-gesture-triggered, from Instellingen) and `trySilentPushResubscribe()` (best-effort, runs on every login if permission was already granted — self-heals a rotated/expired subscription) both register `service-worker.js`, call `pushManager.subscribe()` with `VAPID_PUBLIC_KEY`, and upsert the result into `push_subscriptions` keyed by `endpoint`. On iOS, the "Meldingen inschakelen" button is hidden (with an install hint shown instead) unless the app is already running standalone from the Home Screen — `Notification.requestPermission()` only works from that context on iOS, and only from a direct user-gesture handler.
- `service-worker.js` — push-only service worker (no offline caching): shows the incoming notification, and on click focuses an already-open tab or opens a new one.
- `supabase/functions/send-reminders/` — Deno Edge Function invoked on a schedule by `pg_cron`/`pg_net` (not by a logged-in user, hence `--no-verify-jwt` + a shared `x-cron-secret` header check). For every `user_settings` row it computes that user's local date/time from their stored IANA timezone (`timeWindow.ts`, DST-safe via `Intl.DateTimeFormat`, not string round-tripping), and — guarded by `last_daily_reminder_sent_date`/`last_weekly_reminder_sent_date` so a 10-minute bucket match can't double-send — sends a Web Push message via `npm:web-push` (`sendPush.ts`; Deno's npm-compat, chosen over hand-rolling the RFC 8291/8292 encryption+VAPID signing). Expired subscriptions (`404`/`410` from the push service) are deleted automatically.
- `manifest.json` + `icons/` — enables "Add to Home Screen" for a standalone (fullscreen, no browser chrome) iPhone experience. Icons were generated from `icons/icon.svg` via macOS's built-in `qlmanage`/`sips` (no external tooling) — regenerate with a different `icon.svg` and re-run the same rasterize/resize commands if you want a different look.
