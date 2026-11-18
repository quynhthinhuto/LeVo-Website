export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET')
    return res.status(405).json({error:'GET required'});

  const enabled = process.env.SPEAKING_ENABLED === 'true' && Boolean(
    process.env.OPENAI_API_KEY &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  return res.status(200).json({
    enabled,
    ...(!enabled ? {reason:'speaking_backend_not_configured'} : {}),
    maxSeconds:10,
    dailyLimit:20
  });
}
