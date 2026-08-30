import { supabase } from '../supabaseClient.js';

export function mapSnapshotRow(p, date) {
  return {
    player_id: p.id,
    snapshot_date: date,
    now_cost: p.now_cost,
    selected_by_percent: p.selected_by_percent,
    form: p.form,
    transfers_in_event: p.transfers_in_event,
    transfers_out_event: p.transfers_out_event
  };
}

// Call this AFTER syncBootstrap has run for the day, passing the
// same bootstrap-static payload so it isn't fetched twice. Logging
// this daily is what makes a future price-change model possible —
// FPL only exposes current values, so history can't be backfilled
// later.
export async function syncDailySnapshot(bootstrapData) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rows = bootstrapData.elements.map((p) => mapSnapshotRow(p, today));

  const { error } = await supabase
    .from('daily_player_snapshot')
    .upsert(rows, { onConflict: 'player_id,snapshot_date' });

  if (error) throw new Error(`syncDailySnapshot failed: ${error.message}`);

  console.log(`Logged daily snapshot for ${rows.length} players (${today})`);
}
