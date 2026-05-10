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
    return response.choices[0].message.content;
  } catch (error) {
    console.error('[LLM] API Error:', error.status, error.message);
    console.error('[LLM] Full error:', JSON.stringify({ status: error.status, code: error.code, type: error.type, message: error.message }));
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return "I took too long to think. Please try again. [timeout]";
    }
    if (error.status === 401) {
      return "My brain isn't connected properly. [invalid API key]";
    }
    if (error.status === 403) {
      return "I'm not authorized to think. [API key lacks permissions]";
    }
    if (error.status === 429) {
      return "I'm overwhelmed with requests. Please wait a moment. [rate limit or no credits]";
    }
    if (error.status === 404) {
      return "I can't find my brain model. [model not available]";
    }
    return `I'm having trouble thinking. [${error.status || error.code || 'unknown'}: ${error.message?.substring(0, 100)}]`;
  }
}

module.exports = { generateResponse };
