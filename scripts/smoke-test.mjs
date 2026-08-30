// Validates the row-mapping logic against payloads shaped like the
// real FPL API, without touching the network. Importing the sync
// modules constructs a Supabase client (no network call happens
// until a query is actually sent, and this test never sends one),
// but the client constructor still requires the env vars to be set —
// done via the `smoke-test` npm script, not here, since ESM hoists
// all imports above any other top-level code in the same file.
import assert from 'node:assert/strict';
import { mapTeamRow, mapPlayerRow, mapGameweekRow } from '../src/sync/bootstrap.js';
import { mapFixtureRow } from '../src/sync/fixtures.js';
import { mapSnapshotRow } from '../src/sync/dailySnapshot.js';
import { mapHistoryRow } from '../src/sync/history.js';

const sampleTeam = {
  id: 1, name: 'Arsenal', short_name: 'ARS', strength: 4,
  strength_overall_home: 1250, strength_overall_away: 1300,
  strength_attack_home: 1200, strength_attack_away: 1250,
  strength_defence_home: 1300, strength_defence_away: 1350
};

const samplePlayer = {
  id: 1, first_name: 'Bukayo', second_name: 'Saka', web_name: 'Saka',
  team: 1, element_type: 3, now_cost: 100, status: 'a', news: '', news_added: null,
  chance_of_playing_next_round: 100, selected_by_percent: '45.2', form: '6.5',
  points_per_game: '5.8', total_points: 58, minutes: 810, starts: 9,
  goals_scored: 4, assists: 5, clean_sheets: 3, goals_conceded: 8, own_goals: 0,
  penalties_saved: 0, penalties_missed: 0, yellow_cards: 1, red_cards: 0,
  saves: 0, bonus: 9, bps: 320, influence: '450.2', creativity: '520.1',
  threat: '610.4', ict_index: '158.2', expected_goals: '3.8', expected_assists: '4.1',
  expected_goal_involvements: '7.9', expected_goals_conceded: '6.2',
  defensive_contribution: 12, defensive_contribution_per_90: 1.3,
  transfers_in: 500000, transfers_out: 200000,
  transfers_in_event: 15000, transfers_out_event: 4000
};

const sampleGameweek = {
  id: 5, name: 'Gameweek 5', deadline_time: '2026-09-13T10:00:00Z',
  finished: true, is_current: false, is_next: false, is_previous: true,
  average_entry_score: 54, highest_score: 143,
  most_selected: 1, most_transferred_in: 1, most_captained: 1,
  most_vice_captained: 1, top_element: 1, top_element_info: { points: 18 }
};

const sampleFixture = {
  id: 41, event: 5, team_h: 1, team_a: 2, team_h_score: 3, team_a_score: 1,
  team_h_difficulty: 2, team_a_difficulty: 4,
  kickoff_time: '2026-09-13T14:00:00Z', finished: true, started: true
};

const sampleHistory = {
  fixture: 41, round: 5, was_home: true, opponent_team: 2,
  minutes: 90, total_points: 12, starts: 1, goals_scored: 1, assists: 1,
  clean_sheets: 1, goals_conceded: 1, own_goals: 0, penalties_saved: 0,
  penalties_missed: 0, yellow_cards: 0, red_cards: 0, saves: 0, bonus: 3,
  bps: 45, influence: '55.2', creativity: '48.1', threat: '62.0', ict_index: '16.5',
  expected_goals: '0.6', expected_assists: '0.4', expected_goal_involvements: '1.0',
  expected_goals_conceded: '1.1', defensive_contribution: 2, value: 100, selected: 4500000
};

const teamRow = mapTeamRow(sampleTeam);
assert.equal(teamRow.id, 1);
assert.equal(teamRow.short_name, 'ARS');

const playerRow = mapPlayerRow(samplePlayer);
assert.equal(playerRow.id, 1);
assert.equal(playerRow.team_id, 1); // renamed from `team` -> `team_id`
assert.equal(playerRow.web_name, 'Saka');
assert.equal(playerRow.defensive_contribution, 12);

const gwRow = mapGameweekRow(sampleGameweek);
assert.equal(gwRow.id, 5);
assert.equal(gwRow.top_element_points, 18); // pulled out of nested top_element_info

const fixtureRow = mapFixtureRow(sampleFixture);
assert.equal(fixtureRow.gameweek_id, 5); // renamed from `event` -> `gameweek_id`
assert.equal(fixtureRow.team_h_difficulty, 2);

const snapshotRow = mapSnapshotRow(samplePlayer, '2026-09-10');
assert.equal(snapshotRow.player_id, 1);
assert.equal(snapshotRow.snapshot_date, '2026-09-10');

const historyRow = mapHistoryRow(1, sampleHistory);
assert.equal(historyRow.player_id, 1);
assert.equal(historyRow.fixture_id, 41);
assert.equal(historyRow.gameweek_id, 5);
assert.equal(historyRow.defensive_contribution, 2);

console.log('All mapping smoke tests passed.');
