import { fplApi } from '../fplApi.js';
import { supabase } from '../supabaseClient.js';
import { chunked } from '../util.js';

export function mapFixtureRow(f) {
  return {
    id: f.id,
    gameweek_id: f.event,
    team_h: f.team_h,
    team_a: f.team_a,
    team_h_score: f.team_h_score,
    team_a_score: f.team_a_score,
    team_h_difficulty: f.team_h_difficulty,
    team_a_difficulty: f.team_a_difficulty,
    kickoff_time: f.kickoff_time,
    finished: f.finished,
    started: f.started,
    updated_at: new Date().toISOString()
  };
}

export async function syncFixtures() {
  const fixtures = await fplApi.fixtures();
  const rows = fixtures.map(mapFixtureRow);

  for (const chunk of chunked(rows, 200)) {
    const { error } = await supabase.from('fixtures').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`syncFixtures failed: ${error.message}`);
  }

  console.log(`Synced ${fixtures.length} fixtures`);
  return fixtures.length;
}
