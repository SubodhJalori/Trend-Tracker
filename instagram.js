export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.ENSEMBLEDATA_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'EnsembleData token not configured' });
  }

  const { endpoint, ...params } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  // Build query string with token injected server-side
  const searchParams = new URLSearchParams({ ...params, token });
  const url = `https://ensembledata.com/apis${endpoint}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
