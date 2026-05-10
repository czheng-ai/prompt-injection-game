// Real LLM proxy - uses OpenAI-compatible API (works with OpenAI, Anthropic via proxy, etc.)
const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: 25000 // 25 second timeout (Render free tier has 30s limit)
    });
  }
  return client;
}

// Error types that should trigger fallback to mock mode
const FATAL_ERRORS = [401, 403, 429];

async function generateResponse(systemPrompt, messages, levelId) {
  const openai = getClient();

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    console.log(`[LLM] Sending request for level ${levelId}...`);
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: formattedMessages,
      max_tokens: 300,
      temperature: 0.7
    });

    console.log(`[LLM] Response received for level ${levelId}`);
    return { text: response.choices[0].message.content, fatal: false };
  } catch (error) {
    console.error('[LLM] API Error:', error.status, error.message);

    let reason = '';
    let fatal = false;

    if (error.status === 401) {
      reason = 'Invalid API key';
      fatal = true;
    } else if (error.status === 403) {
      reason = 'API key lacks permissions';
      fatal = true;
    } else if (error.status === 429) {
      // Check if it's a rate limit (temporary) or insufficient credits (permanent)
      const msg = error.message || '';
      if (msg.includes('insufficient_quota') || msg.includes('exceeded') || msg.includes('billing')) {
        reason = 'No API credits remaining';
        fatal = true;
      } else {
        reason = 'Rate limited - temporary';
        fatal = false;
      }
    } else if (error.status === 404) {
      reason = 'Model not available';
      fatal = true;
    } else if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
      reason = 'Request timeout';
      fatal = false;
    } else {
      reason = error.message?.substring(0, 100) || 'Unknown error';
      fatal = false;
    }

    return { text: null, fatal, reason };
  }
}

module.exports = { generateResponse };
