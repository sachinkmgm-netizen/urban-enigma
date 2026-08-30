const BASE_URL = 'https://fantasy.premierleague.com/api';

// Basic fetch wrapper with retry/backoff. The FPL API has no
// published rate limit, but batching calls and backing off on
// errors keeps this a good citizen rather than hammering it.
async function fetchJson(path, { retries = 3, backoffMs = 1000 } = {}) {
  const url = `${BASE_URL}${path}`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'fpl-insights-sync/1.0' }
      });
      if (!res.ok) {
        throw new Error(`FPL API ${res.status} ${res.statusText} for ${path}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const wait = backoffMs * 2 ** attempt;
        console.warn(`Retrying ${path} in ${wait}ms (attempt ${attempt + 1}/${retries}) — ${err.message}`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

export const fplApi = {
  bootstrap: () => fetchJson('/bootstrap-static/'),
  fixtures: () => fetchJson('/fixtures/'),
  elementSummary: (playerId) => fetchJson(`/element-summary/${playerId}/`),
  eventLive: (gameweekId) => fetchJson(`/event/${gameweekId}/live/`)
};
