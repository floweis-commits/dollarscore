// Serverless proxy — GLM via z.ai
// glm-4.5 is a reasoning model: needs high max_tokens, response is in choices[0].message.content

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

const GLM_BASE = 'https://api.z.ai/api/paas/v4/chat/completions';
const MODEL = 'glm-4.5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GLM_API_KEY not configured' });
  }

  const { messages, max_tokens } = req.body;
  if (!messages) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const upstream = await fetch(GLM_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: max_tokens || 16000
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Upstream error' });
    }

    const choice = data.choices?.[0];
    if (!choice) return res.status(500).json({ error: 'No response from model' });

    if (choice.finish_reason === 'length') {
      return res.status(500).json({ error: 'Response truncated — increase max_tokens' });
    }

    const text = choice.message?.content ?? '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
