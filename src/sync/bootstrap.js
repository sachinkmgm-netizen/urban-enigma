import { fplApi } from '../fplApi.js';
import { supabase } from '../supabaseClient.js';
import { chunked } from '../util.js';

export async function syncBootstrap() {
  const data = await fplApi.bootstrap();

  await syncTeams(data.teams);
  await syncPlayers(data.elements);
  await syncGameweeks(data.events);

  console.log(`Synced ${data.teams.length} teams, ${data.elements.length} players, ${data.events.length} gameweeks`);
  return data; // callers (e.g. syncDailySnapshot) can reuse this payload
}

export function mapTeamRow(t) {
  return {
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    strength: t.strength,
    strength_overall_home: t.strength_overall_home,
    strength_overall_away: t.strength_overall_away,
    strength_attack_home: t.strength_attack_home,
    strength_attack_away: t.strength_attack_away,
    strength_defence_home: t.strength_defence_home,
    strength_defence_away: t.strength_defence_away,
    updated_at: new Date().toISOString()
  };
}

export function mapPlayerRow(p) {
  return {
    id: p.id,
    first_name: p.first_name,
    second_name: p.second_name,
    web_name: p.web_name,
    team_id: p.team,
    element_type: p.element_type,
    now_cost: p.now_cost,
    status: p.status,
    news: p.news,
    news_added: p.news_added,
    chance_of_playing_next_round: p.chance_of_playing_next_round,
    selected_by_percent: p.selected_by_percent,
    form: p.form,
    points_per_game: p.points_per_game,
    total_points: p.total_points,
    minutes: p.minutes,
    starts: p.starts,
    goals_scored: p.goals_scored,
    assists: p.assists,
    clean_sheets: p.clean_sheets,
    goals_conceded: p.goals_conceded,
    own_goals: p.own_goals,
    penalties_saved: p.penalties_saved,
    penalties_missed: p.penalties_missed,
    yellow_cards: p.yellow_cards,
    red_cards: p.red_cards,
    saves: p.saves,
    bonus: p.bonus,
    bps: p.bps,
    influence: p.influence,
    creativity: p.creativity,
    threat: p.threat,
    ict_index: p.ict_index,
    expected_goals: p.expected_goals,
    expected_assists: p.expected_assists,
    expected_goal_involvements: p.expected_goal_involvements,
    expected_goals_conceded: p.expected_goals_conceded,
    defensive_contribution: p.defensive_contribution,
    defensive_contribution_per_90: p.defensive_contribution_per_90,
    transfers_in: p.transfers_in,
    transfers_out: p.transfers_out,
    transfers_in_event: p.transfers_in_event,
    transfers_out_event: p.transfers_out_event,
    updated_at: new Date().toISOString()
  };
}

export function mapGameweekRow(e) {
  return {
    id: e.id,
    name: e.name,
    deadline_time: e.deadline_time,
    finished: e.finished,
    is_current: e.is_current,
    is_next: e.is_next,
    is_previous: e.is_previous,
    average_entry_score: e.average_entry_score,
    highest_score: e.highest_score,
    most_selected: e.most_selected,
    most_transferred_in: e.most_transferred_in,
    most_captained: e.most_captained,
    most_vice_captained: e.most_vice_captained,
    top_element: e.top_element,
    top_element_points: e.top_element_info?.points ?? null,
    updated_at: new Date().toISOString()
  };
}

async function syncTeams(teams) {
  const rows = teams.map(mapTeamRow);
  const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`syncTeams failed: ${error.message}`);
}

async function syncPlayers(elements) {
  const rows = elements.map(mapPlayerRow);
  for (const chunk of chunked(rows, 200)) {
    const { error } = await supabase.from('players').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`syncPlayers failed: ${error.message}`);
  }
}

async function syncGameweeks(events) {
  const rows = events.map(mapGameweekRow);
  const { error } = await supabase.from('gameweeks').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`syncGameweeks failed: ${error.message}`);
}
