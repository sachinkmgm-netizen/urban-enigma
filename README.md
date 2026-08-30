# FPL Insights

A Netlify-hosted app backed by Supabase. No auth, no per-user data —
everyone sees the same shared insights (personalization by FPL team ID
is phase 2). Data refreshes on demand via a button, not a fixed
schedule, except for one job that stays on a schedule for reasons
explained below.

## Architecture

- **Frontend**: a single static HTML file (`public/index.html`),
  matching the pattern the World Cup/PL predictor apps already use —
  no build step, no framework, talks to Supabase directly with the
  anon key for both reads and writes.
- **Netlify Function** (`netlify/functions/refresh-fast.js`): what the
  "Refresh data" button calls. Still holds the Supabase service role
  key server-side, but note that's no longer the only way to write —
  RLS is off (see `fpl_insights_schema_v1.sql`, section 13) and the
  anon key has full read/write access too. That's an intentional
  tradeoff: the anon key ships inside `public/index.html` and is
  visible to anyone who views the page source, so anyone who finds
  the site can write to this database directly, not just the app's
  own frontend or the button. Revisit if this app is ever shared
  beyond a small trusted group.
- **Supabase**: the database (`fpl_insights_schema_v1.sql`) plus the
  three materialized views (differential score, DEFCON hit rate,
  fixture swing) the app's insights are built from.
- **GitHub Actions** (`.github/workflows/sync-history.yml`): still
  runs the one expensive job on a schedule (see "Why `history` isn't
  a button" below).

## Setup

1. Run `fpl_insights_schema_v1.sql` against your Supabase project.
   RLS is disabled and the anon key has full read/write access on
   every table (materialized views stay read-only regardless, since
   Postgres doesn't allow writing to a materialized view at all).
2. Copy your Supabase project URL and **anon** key into
   `public/index.html` (replace `YOUR-PROJECT` / `YOUR-ANON-KEY`).
   This key now has full write access — anyone with the URL can
   write to the database, not just read.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment
   variables in your Netlify site (dashboard, or `netlify env:set`).
   **Never** put the service role key in `public/index.html` or
   anywhere else that ships to the browser.
4. For local testing: `cp .env.example .env`, fill in the same two
   values, `npm install`, then `netlify dev` (Netlify CLI) to run the
   function and static site together locally.
5. For the scheduled `history` job specifically, add the same two
   values as **GitHub Actions** repository secrets (separate from
   Netlify's env vars, since that job runs on GitHub's infrastructure,
   not Netlify's).

## The button

Click "Refresh data" → calls `POST /api/refresh-fast` → syncs
`bootstrap-static` and `fixtures`, logs today's price/ownership
snapshot, then refreshes all three materialized views (fixture swing
and differential score both depend on data this touches; DEFCON
doesn't, but refreshing it too is cheap at this data size).

A 2-minute cooldown is enforced **server-side** (via the
`sync_status` table), not just by disabling the button in the
browser — since this might be shared with others, nothing stops two
people clicking at once otherwise. A click during the cooldown gets a
`429` with how long to wait.

## Why `history` isn't a button

`history` backfills `player_gw_stats` from `element-summary`, one API
call per player (~700 calls). Two problems with putting that behind a
button:

- **Timeout.** Netlify's synchronous functions (the kind that can
  return a result to a waiting button) time out well before 700
  sequential calls finish. Background Functions can run longer but
  don't return a result to the caller, and both the exact timeout and
  Background Function availability depend on your Netlify plan — worth
  checking Netlify's current docs for your plan rather than assuming.
- **No actual benefit.** Unlike prices/ownership, this data only
  changes once a gameweek finishes. There's nothing to gain from
  making it on-demand, only timeout risk.

So it stays on `.github/workflows/sync-history.yml`, running once
daily (idempotent, so daily is safe even though it's only strictly
needed after each gameweek ends).

## Jobs reference

| Job         | Trigger                          | What it does                                                        |
|-------------|-----------------------------------|-----------------------------------------------------------------------|
| `fast`      | The button (`refresh-fast.js`)   | bootstrap + fixtures + daily snapshot + refresh all 3 insight views  |
| `history`   | GitHub Actions, daily             | Backfills `player_gw_stats`, then refreshes all 3 insight views      |

`src/index.js` still works as a CLI for local manual runs of any job
(`node src/index.js bootstrap`, etc.) if you want to run one without
going through the button or waiting for the scheduled workflow.

## Testing

```
npm install
npm run smoke-test
```

Checks the row-mapping logic against sample payloads shaped like the
real FPL API. Separately verified for this delivery, without a real
Supabase project: the Netlify Function's relative imports resolve
correctly, its non-POST method guard returns a 405 without needing
any network access, and all files parse as valid JS (including the
frontend's inline script, extracted and checked separately).

## Not tested against live endpoints

As before: this hasn't run end-to-end against the real FPL API or a
live Supabase/Netlify deployment, since neither was reachable from the
environment this was built in. Before trusting the button on a
schedule of real usage, worth doing one live click against your own
Supabase project and checking the `sync_status` row it leaves behind.
