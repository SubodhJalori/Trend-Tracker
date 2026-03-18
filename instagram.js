// Apify proxy — token stays server-side, never exposed to browser
// Uses official Apify actors:
//   Profile: apify~instagram-profile-scraper
//   Reels:   apify~instagram-reel-scraper
//   Hashtag: apify~instagram-scraper

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Apify token not configured' });
  }

  const { actor, input } = req.body;
  if (!actor || !input) {
    return res.status(400).json({ error: 'Missing actor or input' });
  }

  // Allowlist — only permit these specific actors
  const ALLOWED_ACTORS = [
    'apify~instagram-profile-scraper',
    'apify~instagram-reel-scraper',
    'apify~instagram-scraper',
  ];
  if (!ALLOWED_ACTORS.includes(actor)) {
    return res.status(400).json({ error: 'Actor not allowed' });
  }

  try {
    // run-sync-get-dataset-items — runs the actor and waits for results
    const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
