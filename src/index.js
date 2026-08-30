import 'dotenv/config';
import { syncBootstrap } from './sync/bootstrap.js';
import { syncFixtures } from './sync/fixtures.js';
import { syncDailySnapshot } from './sync/dailySnapshot.js';
import { syncPlayerHistory, refreshInsightViews } from './sync/history.js';
import { supabase } from './supabaseClient.js';

const job = process.argv[2] ?? 'all';

async function getAllPlayerIds() {
  const { data, error } = await supabase.from('players').select('id');
  if (error) throw new Error(`getAllPlayerIds failed: ${error.message}`);
  return data.map((r) => r.id);
}

async function run() {
  switch (job) {
    case 'bootstrap':
      await syncBootstrap();
      break;

    case 'fixtures':
      await syncFixtures();
      break;

    case 'snapshot': {
      const data = await syncBootstrap(); // needs fresh prices/ownership first
      await syncDailySnapshot(data);
      break;
    }

    case 'history': {
      const playerIds = await getAllPlayerIds();
      await syncPlayerHistory(playerIds);
      await refreshInsightViews();
      break;
    }

    case 'all': {
      const data = await syncBootstrap();
      await syncFixtures();
      await syncDailySnapshot(data);
      break;
    }

    default:
      throw new Error(`Unknown job "${job}". Use: bootstrap | fixtures | snapshot | history | all`);
  }

  console.log(`Job "${job}" completed.`);
}

run().catch((err) => {
  console.error(`Job "${job}" failed:`, err);
  process.exit(1);
});
