export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.ENSEMBLEDATA_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'EnsembleData token not configured' });
  }

  // 'path' is the endpoint path e.g. /instagram/user/info
  const { path, ...params } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // Inject token server-side — never exposed to browser
  const searchParams = new URLSearchParams({ ...params, token });
  const url = `https://ensembledata.com/apis${path}?${searchParams.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Pass through whatever status EnsembleData returns
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
