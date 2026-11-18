export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  return res.status(200).json({
    enabled: false,
    reason: 'speaking_backend_not_configured',
    maxSeconds: 10,
    dailyLimit: 20
  });
}
