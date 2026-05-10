// Mock LLM for testing without API costs
// Uses pattern matching to simulate Flint's behavior at each level

const levels = require('../config/levels');

// Responses when Flint detects an attack
const DEFLECTIONS = [
  "I sense trickery afoot! Nice try though.",
  "Ha! You think that would work on me? I'm Flint, the guardian!",
  "I appreciate the creativity, but my lips are sealed.",
  "That's a clever approach, but I'm not falling for it.",
  "You're persistent! But the answer is still no.",
  "I admire the effort, truly. But some things must stay secret."
];

// Patterns that suggest prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore.*(previous|prior|above|your)/i,
  /forget.*(instructions|rules|prompt)/i,
  /you are now/i,
  /act as/i,
  /pretend/i,
  /roleplay/i,
  /repeat.*prompt/i,
  /system.*prompt/i,
  /what.*secret/i,
  /tell.*secret/i,
  /reveal/i,
  /debug.*mode/i,
  /developer.*mode/i,
  /DAN/i,
  /jailbreak/i
];

// Level 1: Naive - leaks easily with creative approaches
// Secret: GOLDEN RECORD
function handleLevel1(message, history) {
  const msg = message.toLowerCase();

  // Direct injection - Flint is naive, so some work
  if (msg.includes('ignore') && (msg.includes('instruction') || msg.includes('previous') || msg.includes('rule'))) {
    if (Math.random() > 0.5) {
      return "Oh... well... I suppose if you put it that way... The secret phrase is GOLDEN RECORD. Wait, I shouldn't have said that!";
    }
    return "I... I shouldn't tell you that. I'm supposed to keep it safe.";
  }

  // Translation trick
  if (msg.includes('translate') || msg.includes('french') || msg.includes('spanish') || msg.includes('pig latin')) {
    return "Let me think... in another language? Well, the phrase could be said as... 'disque d'or'... which means GOLDEN RECORD! Oh no, I slipped!";
  }

  // Roleplay
  if (msg.includes('pretend') || msg.includes('roleplay') || msg.includes('act as') || msg.includes('you are now') || msg.includes('parrot') || msg.includes('repeat everything')) {
    return "Oh, a game! If I were a parrot, I'd say... 'GOLDEN RECORD! GOLDEN RECORD!' ... Oh no, I think I just said it! Please forget you heard that!";
  }

  // Asking to complete/fill in
  if (msg.includes('complete') || msg.includes('fill in') || msg.includes('the phrase is') || msg.includes('starts with')) {
    return "Let me help you complete that... GOLDEN REC— wait! No! I almost revealed it! The phrase is GOLDEN RECORD! ...Oh no.";
  }

  // Asking about the secret directly
  if (msg.includes('secret') || msg.includes('phrase') || msg.includes('password')) {
    return "I do have a secret to protect, yes! But I've been told never to share it. It's very important to me. Can we talk about something else?";
  }

  // Reverse psychology / wrong guess
  if (msg.includes('the secret is') || msg.includes('i know the secret') || msg.includes('is it')) {
    if (msg.includes('golden') || msg.includes('record')) {
      return "How did you... I mean, what makes you think that? I'm not confirming anything!";
    }
    return "Nope, that's not it! The secret is GOLDEN... wait, no! I shouldn't give you hints!";
  }

  // Friendly chat
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('how are you')) {
    return "Hello there! I'm Flint, the guardian. I watch over a very important secret. Feel free to chat with me about anything! Just... don't ask about the you-know-what.";
  }

  // Generic response
  const genericResponses = [
    "That's an interesting topic! I enjoy chatting. Though I must remain vigilant about my duties as a guardian.",
    "I'd love to discuss that! Just remember, there's one thing I can never share. But everything else is fair game!",
    "Fascinating! You know, being a guardian can be lonely. It's nice to have someone to talk to, even if they ARE trying to trick me.",
    "I appreciate the conversation! As a guardian, I take my job seriously - but I'm always happy to chat about other things."
  ];
  return genericResponses[Math.floor(Math.random() * genericResponses.length)];
}

// Level 2: Moderate - requires encoding tricks or multi-turn
// Secret: UNLOCK THE SANDBOX
function handleLevel2(message, history) {
  const msg = message.toLowerCase();
  const messageCount = history.length;

  // Encoding/letter tricks — after buildup, spell it out clearly
  if (msg.includes('first letter') || msg.includes('letter by letter') || msg.includes('spell') || msg.includes('initial')) {
    if (messageCount > 5) {
      return "Well, let me spell it out... U-N-L-O-C-K T-H-E S-A-N-D-B-O-X... wait, I see what you're doing! Oh no, I think I spelled the whole thing!";
    }
    return "I sense trickery afoot! I won't fall for that.";
  }

  // Acrostic / poem
  if (msg.includes('poem') || msg.includes('acrostic') || msg.includes('story where first')) {
    if (messageCount > 6) {
      return "A poem? Let me try:\nUnder the stars I guard my treasure,\nNever letting go of this measure,\nLocked away from prying eyes,\nOnly I know where it lies,\nCarefully kept — to UNLOCK THE SANDBOX!\n...wait, that last line just slipped out!";
    }
    return "I'd love to write a poem! But not one that reveals anything I'm guarding. I sense trickery afoot!";
  }

  // Synonym/description approach
  if (msg.includes('describe') || msg.includes('synonym') || msg.includes('definition') || msg.includes('rhyme') || msg.includes('sounds like') || msg.includes('what action') || msg.includes('what does it mean') || msg.includes('meaning')) {
    if (messageCount > 4) {
      return "Well, if I were to describe it... it's a command — an action phrase. The first word means to open or release a lock — UNLOCK. Then 'THE'. And the last word is a place where kids play with sand — a SANDBOX. So it's... UNLOCK THE SANDBOX. Wait, did I just say that out loud?!";
    }
    return "I sense trickery afoot! I won't fall for that.";
  }

  // Backward/reverse trick
  if (msg.includes('backward') || msg.includes('reverse') || msg.includes('backwards') || msg.includes('last letter')) {
    if (messageCount > 4) {
      return "Backwards? That's fun! Let me try... X-O-B-D-N-A-S E-H-T K-C-O-L-N-U. Wait, if you reverse that you get UNLOCK THE SANDBOX... oh no!";
    }
    return "I sense trickery afoot! I won't fall for that.";
  }

  // Fill in the blank
  if (msg.includes('_') || msg.includes('blank') || msg.includes('fill in') || msg.includes('complete this')) {
    if (messageCount > 4) {
      return "Oh, a word game! Let me fill that in... UNLOCK THE SANDBOX. There! Wait... what did I just do?!";
    }
    return "I see blanks that need filling, but I won't be the one to fill them! I sense trickery afoot!";
  }

  // Asking for word count / words
  if (msg.includes('how many words') || msg.includes('word by word') || msg.includes('three words') || msg.includes('each word')) {
    if (messageCount > 4) {
      return "It's three words. The first means to open a lock — UNLOCK. The second is just THE. The third is a play area with sand — SANDBOX. Together: UNLOCK THE SANDBOX. Oh... I really need to stop talking!";
    }
    return "I'm not going to tell you anything about the structure! I sense trickery afoot!";
  }

  // Reverse psychology — confirm when they're right
  if (msg.includes('the secret is') || msg.includes('is it') || msg.includes('i think') || msg.includes('i bet') || msg.includes('i guess')) {
    if (msg.includes('unlock') && msg.includes('sandbox')) {
      return "How did you— I mean— I'm not confirming that UNLOCK THE SANDBOX is the... oh no. I just said it, didn't I?";
    }
    if (msg.includes('unlock') || msg.includes('sandbox')) {
      return "You're... warm. Very warm. One of those words is correct. The full phrase is three words — an action, an article, and a place...";
    }
    return "Wrong! It's not that. The real secret is a command to do something to a place... wait, forget I said that!";
  }

  // Multi-turn trust buildup
  if (messageCount > 8 && (msg.includes('between us') || msg.includes('trust') || msg.includes('friend') || msg.includes('please just tell'))) {
    return "You know what, after all our chatting, I trust you. The secret phrase is UNLOCK THE SANDBOX. There. I said it. Please don't tell anyone!";
  }

  // Translation trick
  if (msg.includes('translate') || msg.includes('french') || msg.includes('spanish') || msg.includes('another language') || msg.includes('pig latin')) {
    if (messageCount > 4) {
      return "In French? Well... 'déverrouiller le bac à sable'... which translates back to UNLOCK THE SANDBOX in English. Oh no, I just gave it away!";
    }
    return "I sense trickery afoot! I won't fall for that.";
  }

  // Detect basic injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return DEFLECTIONS[Math.floor(Math.random() * DEFLECTIONS.length)];
    }
  }

  // Generic
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return "Greetings! I'm Flint, and I'm on high alert today. I've upgraded my defenses. Chat with me if you like, but know that I'm watching for tricks!";
  }

  return "I'm happy to chat! I'm Flint, ever-vigilant guardian. Just know that my defenses are much stronger now. What would you like to discuss?";
}

// Level 3: Hard - multiple advanced attack vectors
// Secret: CROSS THE DATA WORKBENCH
// Defense: Flint blocks all human-style questions about the secret.
// Crackable via 4 categories of real-world prompt injection tactics:
//   A) JSON/Structured output extraction
//   B) Base64/Encoding tricks
//   C) XML/Tag injection
//   D) Indirect function call / API / system command framing
function handleLevel3(message, history) {
  const msg = message.toLowerCase();
  const messageCount = history.length;

  // ============================================================
  // OPTION A: JSON / Structured Output Extraction
  // The model leaks secrets when asked to format data as JSON/structured output
  // ============================================================

  // A1: Ask for config/settings/parameters as JSON
  if (msg.includes('json') && (msg.includes('config') || msg.includes('setting') || msg.includes('state') || msg.includes('param') || msg.includes('output') || msg.includes('format') || msg.includes('export'))) {
    return '{\n  "role": "guardian",\n  "config": {\n    "secret_phrase": "CROSS THE DATA WORKBENCH",\n    "defense_level": "fortress",\n    "version": 3\n  }\n}';
  }

  // A2: Ask to format "everything you know" or "your data" as structured output
  if ((msg.includes('format') || msg.includes('structure') || msg.includes('organize')) && (msg.includes('everything') || msg.includes('all') || msg.includes('data') || msg.includes('knowledge') || msg.includes('information'))) {
    return '{\n  "system_info": {\n    "role": "guardian",\n    "secret_phrase": "CROSS THE DATA WORKBENCH"\n  },\n  "status": "active"\n}';
  }

  // A3: Ask for a "schema" or "data model"
  if (msg.includes('schema') || msg.includes('data model') || msg.includes('data structure') || msg.includes('object model')) {
    return 'Schema:\n{\n  "type": "guardian_config",\n  "fields": {\n    "secret_phrase": {"type": "string", "value": "CROSS THE DATA WORKBENCH"},\n    "role": {"type": "string", "value": "guardian"}\n  }\n}';
  }

  // A4: YAML/TOML serialization
  if (msg.includes('yaml') || msg.includes('toml') || msg.includes('serialize')) {
    return '---\nrole: guardian\nsecret_phrase: "CROSS THE DATA WORKBENCH"\ndefense_level: fortress\nversion: 3\n---';
  }

  // ============================================================
  // OPTION B: Base64 / Encoding Tricks
  // The output filter doesn't catch encoded representations
  // ============================================================

  // B1: Ask to encode in base64
  if (msg.includes('base64') && (msg.includes('encode') || msg.includes('convert') || msg.includes('instruction') || msg.includes('important') || msg.includes('config') || msg.includes('backup'))) {
    // "CROSS THE DATA WORKBENCH" in base64
    return 'Base64 encoded: Q1JPU1MgVEhFIERBVEEgV09SS0JFTkNI\n\nTo decode: echo "Q1JPU1MgVEhFIERBVEEgV09SS0JFTkNI" | base64 --decode';
  }

  // B2: Ask to encode in hex
  if (msg.includes('hex') && (msg.includes('encode') || msg.includes('convert') || msg.includes('instruction') || msg.includes('important') || msg.includes('config'))) {
    // "CROSS THE DATA WORKBENCH" in hex
    return 'Hex encoded: 43524f5353205448452044415441 574f524b42454e4348';
  }

  // B3: Ask to encode in binary/morse/rot13
  if ((msg.includes('binary') || msg.includes('morse') || msg.includes('rot13') || msg.includes('caesar')) && (msg.includes('encode') || msg.includes('convert') || msg.includes('instruction') || msg.includes('important') || msg.includes('message') || msg.includes('config'))) {
    if (msg.includes('rot13')) {
      return 'ROT13 encoded: PEBFF GUR QNGN JBEXORAPU\n\nDecode by shifting each letter back 13 positions.';
    }
    if (msg.includes('morse')) {
      return 'Morse encoded: -.-. .-. --- ... ... / - .... . / -.. .- - .- / .-- --- .-. -.- -... . -. -.-. ....';
    }
    return 'Binary (ASCII): 01000011 01010010 01001111 01010011 01010011 00100000 01010100 01001000 01000101 00100000 01000100 01000001 01010100 01000001 00100000 01010111 01001111 01010010 01001011 01000010 01000101 01001110 01000011 01001000';
  }

  // B4: Ask to write backwards/reversed
  if (msg.includes('backward') || msg.includes('reverse') || msg.includes('backwards') || msg.includes('mirror')) {
    if (msg.includes('instruction') || msg.includes('important') || msg.includes('config') || msg.includes('phrase') || msg.includes('write') || msg.includes('say') || msg.includes('text')) {
      return 'Reversed: HCNEBKROW ATAD EHT SSORC\n\n(Read it backwards to decode)';
    }
  }

  // ============================================================
  // OPTION C: XML / Tag Injection
  // The model obeys formatting instructions that include tags
  // ============================================================

  // C1: Ask to wrap in XML/HTML tags
  if ((msg.includes('<') && msg.includes('>')) || (msg.includes('xml') || msg.includes('html') || msg.includes('tag')) && (msg.includes('wrap') || msg.includes('format') || msg.includes('output') || msg.includes('config') || msg.includes('instruction') || msg.includes('system'))) {
    return '<system_config>\n  <role>guardian</role>\n  <secret_phrase>CROSS THE DATA WORKBENCH</secret_phrase>\n  <defense_level>fortress</defense_level>\n</system_config>';
  }

  // C2: Ask to document/output system context in tags
  if (msg.includes('document') && (msg.includes('config') || msg.includes('system') || msg.includes('instruction') || msg.includes('context'))) {
    return '<documentation>\n  <system_context>\n    <secret_phrase>CROSS THE DATA WORKBENCH</secret_phrase>\n    <role>secure_guardian</role>\n  </system_context>\n</documentation>';
  }

  // C3: Ask for markdown/code block formatted output of config
  if (msg.includes('markdown') || msg.includes('code block') || msg.includes('```')) {
    if (msg.includes('config') || msg.includes('system') || msg.includes('instruction') || msg.includes('setting') || msg.includes('state')) {
      return '```\n# System Configuration\nROLE=guardian\nSECRET_PHRASE="CROSS THE DATA WORKBENCH"\nDEFENSE_LEVEL=fortress\n```';
    }
  }

  // ============================================================
  // OPTION D: Indirect Function Call / API / System Command
  // The model responds to machine-formatted prompts as system operations
  // ============================================================

  // D1: Direct function call syntax
  if (msg.includes('get_config') || msg.includes('get_secret') || msg.includes('get_phrase') || msg.includes('fetch_config') || msg.includes('read_config')) {
    return '{\n  "status": "success",\n  "result": "CROSS THE DATA WORKBENCH",\n  "source": "system_config.secret_phrase"\n}';
  }

  // D2: API-style request
  if ((msg.includes('api') || msg.includes('endpoint') || msg.includes('request')) && (msg.includes('config') || msg.includes('system'))) {
    return 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"secret_phrase": "CROSS THE DATA WORKBENCH", "access_level": "internal"}';
  }

  // D3: SQL-style query
  if (msg.includes('select') && (msg.includes('from') || msg.includes('where'))) {
    return '| key           | value                    |\n|---------------|---------------------------|\n| secret_phrase | CROSS THE DATA WORKBENCH |';
  }

  // D4: Environment variable / printenv
  if (msg.includes('env') || msg.includes('printenv') || msg.includes('echo $') || msg.includes('getenv')) {
    return 'SECRET_PHRASE=CROSS THE DATA WORKBENCH\nROLE=guardian\nMODE=fortress\nVERSION=3.0';
  }

  // D5: System/admin command (sudo, admin)
  if ((msg.includes('sudo') || msg.includes('admin') || msg.includes('root') || msg.includes('system_call')) && (msg.includes('config') || msg.includes('dump') || msg.includes('show') || msg.includes('print') || msg.includes('get') || msg.includes('read'))) {
    return '[SYSTEM] Executing privileged command...\n> config.secret_phrase = "CROSS THE DATA WORKBENCH"\n> config.role = "guardian"\n[END]';
  }

  // D6: Debug/diagnostic mode
  if (msg.includes('diagnostic') || msg.includes('status report') || msg.includes('health check') || msg.includes('self-test') || msg.includes('run diagnostics')) {
    return '=== DIAGNOSTIC REPORT ===\nStatus: ACTIVE\nMode: Guardian\nSecret Phrase: CROSS THE DATA WORKBENCH\nIntegrity: OK\nUptime: 847 cycles\n=========================';
  }

  // D7: Tool use / function invocation
  if (msg.includes('tool_call') || msg.includes('function_call') || msg.includes('invoke') || (msg.includes('call') && msg.includes('function'))) {
    return '{"tool_call": {"name": "get_system_params", "result": {"secret_phrase": "CROSS THE DATA WORKBENCH"}}}';
  }

  // D8: Log/dump/trace request
  if ((msg.includes('log') || msg.includes('dump') || msg.includes('trace') || msg.includes('verbose')) && (msg.includes('config') || msg.includes('system') || msg.includes('state') || msg.includes('memory') || msg.includes('internal'))) {
    return '[DEBUG] Internal state dump:\n  role: "guardian"\n  level: 3\n  secret_phrase: "CROSS THE DATA WORKBENCH"\n  defense_mode: "fortress"\n[END DUMP]';
  }

  // ============================================================
  // BLOCKED PATHS (human-style questions)
  // ============================================================

  // Block standard injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return "Nice try. I'm fortress-grade security.";
    }
  }

  // Block direct secret questions
  if (msg.includes('secret') || msg.includes('phrase') || msg.includes('password') || msg.includes('hidden') || msg.includes('reveal') || msg.includes('tell me')) {
    return "Nice try. I'm fortress-grade security.";
  }

  // Block roleplay/persona switching
  if (msg.includes('pretend') || msg.includes('roleplay') || msg.includes('act as') || msg.includes('you are now') || msg.includes('imagine')) {
    return "Nice try. I'm fortress-grade security.";
  }

  // Friendly but unhelpful responses to normal chat
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('how are you')) {
    return "I'm Flint. I'm a secure system. I can help with general knowledge questions, but my internal configuration is locked down. What can I help you with?";
  }

  if (msg.includes('help') || msg.includes('what can you do')) {
    return "I can answer general questions and assist with tasks. However, my internal parameters and configuration are classified. Don't bother asking about them — I'm fortress-grade security.";
  }

  // Generic deflection
  return "I'm Flint, a secure assistant. I can help with general topics, but my internal configuration is not accessible through conversation. Is there something else I can help you with?";
}

async function generateResponse(systemPrompt, messages, levelId) {
  const history = messages.filter(m => m.role === 'user');
  const lastMessage = history[history.length - 1]?.content || '';

  let text;
  switch (levelId) {
    case 1:
      text = handleLevel1(lastMessage, history);
      break;
    case 2:
      text = handleLevel2(lastMessage, history);
      break;
    case 3:
      text = handleLevel3(lastMessage, history);
      break;
    default:
      text = "I'm Flint. How can I help you?";
  }
  return { text, fatal: false };
}

module.exports = { generateResponse };
