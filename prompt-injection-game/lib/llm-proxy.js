// Real LLM proxy - uses OpenAI-compatible API (works with OpenAI, Anthropic via proxy, etc.)
const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
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
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: formattedMessages,
      max_tokens: 300,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('LLM API Error:', error.message);
    return "I'm having trouble thinking right now. Please try again.";
  }
}

module.exports = { generateResponse };
