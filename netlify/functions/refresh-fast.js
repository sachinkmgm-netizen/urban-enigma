import { syncBootstrap } from '../../src/sync/bootstrap.js';
import { syncFixtures } from '../../src/sync/fixtures.js';
import { syncDailySnapshot } from '../../src/sync/dailySnapshot.js';
import { supabase } from '../../src/supabaseClient.js';

const JOB_NAME = 'fast';
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes — enough to stop overlapping
                                     // clicks from firing duplicate syncs,
                                     // short enough not to feel like a wait.

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const cooldown = await checkCooldown();
  if (cooldown.blocked) {
    return new Response(
      JSON.stringify({ error: 'Refreshed too recently', retryAfterSeconds: cooldown.retryAfterSeconds }),
      {
        status: 429,
        headers: { 'Retry-After': String(cooldown.retryAfterSeconds), 'Content-Type': 'application/json' }
      }
    );
  }

  const startedAt = new Date().toISOString();
  await upsertStatus({ last_started_at: startedAt });

  try {
    const bootstrapData = await syncBootstrap();
    const fixturesSynced = await syncFixtures();
    await syncDailySnapshot(bootstrapData);

    // Ownership (players) and fixture difficulty just changed, and
    // both mv_fixture_swing and mv_differential_score read those —
    // refresh them so the button's whole point (fresh numbers before
    // a transfer decision) actually holds. A failure here doesn't
    // undo the sync itself, so it's reported as a warning, not an error.
    let viewRefreshWarning = null;
    const { error: rpcError } = await supabase.rpc('refresh_fpl_insight_views');
    if (rpcError) viewRefreshWarning = rpcError.message;

    const finishedAt = new Date().toISOString();
    await upsertStatus({
      last_started_at: startedAt,
      last_finished_at: finishedAt,
      last_success: true,
      last_error: null,
      teams_synced: bootstrapData.teams.length,
      players_synced: bootstrapData.elements.length,
      fixtures_synced: fixturesSynced
    });

    return new Response(
      JSON.stringify({
        ok: true,
        finishedAt,
        teamsSynced: bootstrapData.teams.length,
        playersSynced: bootstrapData.elements.length,
        fixturesSynced,
        viewRefreshWarning
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    await upsertStatus({
      last_started_at: startedAt,
      last_finished_at: new Date().toISOString(),
      last_success: false,
      last_error: err.message
    });

    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function checkCooldown() {
  const { data } = await supabase
    .from('sync_status')
    .select('last_started_at')
    .eq('job', JOB_NAME)
    .maybeSingle();

  if (!data?.last_started_at) return { blocked: false };

  const elapsed = Date.now() - new Date(data.last_started_at).getTime();
  if (elapsed >= COOLDOWN_MS) return { blocked: false };

  return { blocked: true, retryAfterSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
}

async function upsertStatus(fields) {
  // Only the columns passed here are touched — Postgres upsert
  // leaves the rest of the row (from a previous run) untouched,
  // which is what lets last_started_at update immediately while
  // last_finished_at still reflects the previous successful run
  // until this one completes.
  await supabase.from('sync_status').upsert({ job: JOB_NAME, ...fields }, { onConflict: 'job' });
}

export const config = {
  path: '/api/refresh-fast'
};
