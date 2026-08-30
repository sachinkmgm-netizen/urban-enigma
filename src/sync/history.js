import { fplApi } from '../fplApi.js';
import { supabase } from '../supabaseClient.js';

export function mapHistoryRow(playerId, h) {
  return {
    player_id: playerId,
    fixture_id: h.fixture,
    gameweek_id: h.round,
    was_home: h.was_home,
    opponent_team_id: h.opponent_team,
    minutes: h.minutes,
    total_points: h.total_points,
    starts: h.starts,
    goals_scored: h.goals_scored,
    assists: h.assists,
    clean_sheets: h.clean_sheets,
    goals_conceded: h.goals_conceded,
    own_goals: h.own_goals,
    penalties_saved: h.penalties_saved,
    penalties_missed: h.penalties_missed,
    yellow_cards: h.yellow_cards,
    red_cards: h.red_cards,
    saves: h.saves,
    bonus: h.bonus,
    bps: h.bps,
    influence: h.influence,
    creativity: h.creativity,
    threat: h.threat,
    ict_index: h.ict_index,
    expected_goals: h.expected_goals,
    expected_assists: h.expected_assists,
    expected_goal_involvements: h.expected_goal_involvements,
    expected_goals_conceded: h.expected_goals_conceded,
    defensive_contribution: h.defensive_contribution,
    value: h.value,
    selected: h.selected
  };
}

// Backfills player_gw_stats from element-summary history for every
// player — this is the only endpoint with full per-fixture detail
// (xG, ICT, defensive contribution), so it's the source for the
// archive table. Run once a finished gameweek's bonus points have
// locked; there's no need to poll this on a tight schedule the way
// bootstrap/fixtures are.
export async function syncPlayerHistory(playerIds) {
  let synced = 0;

  for (const playerId of playerIds) {
    const { history } = await fplApi.elementSummary(playerId);
    if (history.length === 0) continue;

    const rows = history.map((h) => mapHistoryRow(playerId, h));

    const { error } = await supabase
      .from('player_gw_stats')
      .upsert(rows, { onConflict: 'player_id,fixture_id' });

    if (error) throw new Error(`syncPlayerHistory failed for player ${playerId}: ${error.message}`);

    synced += rows.length;

    // Light pacing across ~700 calls — keeps this a good citizen
    // rather than firing every request at once.
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`Synced ${synced} player-gameweek rows across ${playerIds.length} players`);
}

export async function refreshInsightViews() {
  const { error } = await supabase.rpc('refresh_fpl_insight_views');
  if (error) throw new Error(`refreshInsightViews failed: ${error.message}`);
  console.log('Refreshed materialized views');
}
