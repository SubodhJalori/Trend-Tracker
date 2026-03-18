// Apify proxy using async run + polling
// Avoids Vercel's 10s timeout by starting the run then polling until done

const ALLOWED_ACTORS = [
  'apify~instagram-profile-scraper',
  'apify~instagram-reel-scraper',
  'apify~instagram-scraper',
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Apify token not configured' });
  }

  const { actor, input } = req.body || {};
  if (!actor || !input) {
    return res.status(400).json({ error: 'Missing actor or input' });
  }

  if (!ALLOWED_ACTORS.includes(actor)) {
    return res.status(400).json({ error: 'Actor not allowed' });
  }

  const base = 'https://api.apify.com/v2';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    // Step 1 — Start the actor run (async, returns immediately)
    const runRes = await fetch(`${base}/acts/${actor}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!runRes.ok) {
      const err = await runRes.text();
      return res.status(runRes.status).json({ error: `Failed to start actor: ${err}` });
    }

    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) {
      return res.status(500).json({ error: 'No run ID returned from Apify' });
    }

    // Step 2 — Poll for completion (max 55 seconds to stay under Vercel limit)
    const deadline = Date.now() + 55_000;
    let status = 'RUNNING';

    while (Date.now() < deadline) {
      await sleep(3000); // wait 3s between polls

      const statusRes = await fetch(`${base}/actor-runs/${runId}`, { headers });
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      status = statusData?.data?.status;

      if (status === 'SUCCEEDED') break;
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        return res.status(500).json({ error: `Apify run ${status.toLowerCase()}` });
      }
    }

    if (status !== 'SUCCEEDED') {
      return res.status(504).json({ error: 'Apify run timed out — try again or reduce resultsLimit' });
    }

    // Step 3 — Fetch the dataset items
    const datasetId = runData?.data?.defaultDatasetId;
    const itemsRes = await fetch(
      `${base}/datasets/${datasetId}/items?clean=true&format=json`,
      { headers }
    );

    if (!itemsRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch results from Apify' });
    }

    const items = await itemsRes.json();
    return res.status(200).json(Array.isArray(items) ? items : []);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
