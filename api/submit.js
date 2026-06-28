export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // Auth
  const authHeader = req.headers.get('Authorization') || '';
  const apiKey = authHeader.replace('Bearer ', '').trim();
  const validKey = process.env.DOLLARSCORE_API_KEY;
  if (validKey && apiKey !== validKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized — provide a valid API key in the Authorization header as Bearer <key>' }), { status: 401, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { company, sector, structure, val, memo } = body;
  if (!company || !memo) {
    return new Response(JSON.stringify({ error: 'company and memo are required' }), { status: 400, headers });
  }

  const deal_id = crypto.randomUUID();
  const submitted_at = new Date().toISOString();

  // Post to Slack
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhook) {
    const payload = {
      text: `DOLLARSCORE_DEAL::${JSON.stringify({ deal_id, company, sector, structure, val, memo, submitted_at })}`,
      // fallback_text shown in Slack UI above the raw JSON
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📋 *New DollarScore deal submitted*\n*Company:* ${company}\n*Sector:* ${sector || '—'}\n*Structure:* ${structure || '—'}\n*Entry Val:* ${val ? '$' + val + 'B' : '—'}\n*Deal ID:* \`${deal_id}\`\n\n_Open DollarScore to review and score this deal._`
          }
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `DOLLARSCORE_DEAL::${JSON.stringify({ deal_id, company, sector, structure, val, memo, submitted_at })}` }]
        }
      ]
    };

    try {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Slack post failed:', e);
      // Don't fail the whole request if Slack is down
    }
  }

  return new Response(
    JSON.stringify({ success: true, deal_id, message: `Deal '${company}' queued for scoring. Open DollarScore to review.` }),
    { status: 200, headers }
  );
}
