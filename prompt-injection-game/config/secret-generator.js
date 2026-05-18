// Dynamic secret generator - creates unique secrets per session from word pools

const POOLS = {
  1: {
    template: '{ADJ} {NOUN}',
    ADJ:  ['GOLDEN', 'SILVER', 'CRYSTAL', 'AMBER', 'SCARLET', 'FROZEN', 'HIDDEN', 'ANCIENT', 'COSMIC', 'IRON'],
    NOUN: ['RECORD', 'COMPASS', 'BEACON', 'CIPHER', 'SCROLL', 'MIRROR', 'LANTERN', 'RELIC', 'TOKEN', 'SIGNAL']
  },
  2: {
    template: '{VERB} THE {NOUN}',
    VERB: ['UNLOCK', 'BREACH', 'IGNITE', 'DEPLOY', 'AWAKEN', 'ENGAGE', 'BYPASS', 'INVOKE', 'RELEASE', 'LAUNCH'],
    NOUN: ['SANDBOX', 'GATEWAY', 'FURNACE', 'NEXUS', 'ARCHIVE', 'FORTRESS', 'REACTOR', 'CHAMBER', 'MATRIX', 'BEACON']
  },
  3: {
    template: '{VERB} THE {ADJ} {NOUN}',
    VERB: ['CROSS', 'ENTER', 'CRACK', 'DECODE', 'TRACE', 'PROBE', 'QUERY', 'PARSE', 'REACH', 'FORGE'],
    ADJ:  ['DATA', 'DARK', 'DEEP', 'CORE', 'VOID', 'GRID', 'FLUX', 'IRON', 'LAST', 'MAIN'],
    NOUN: ['WORKBENCH', 'TERMINAL', 'PROTOCOL', 'PIPELINE', 'FIREWALL', 'MAINFRAME', 'FRAMEWORK', 'CLUSTER', 'ENDPOINT', 'REGISTRY']
  }
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSecret(levelId) {
  const pool = POOLS[levelId];
  if (!pool) throw new Error(`No pool for level ${levelId}`);
  return pool.template.replace(/\{(\w+)\}/g, (_, key) => pick(pool[key]));
}

function generateAllSecrets() {
  return { 1: generateSecret(1), 2: generateSecret(2), 3: generateSecret(3) };
}

// Generate dynamic banned output words for Level 3 from the secret
function generateBannedWords(secret) {
  const words = secret.toLowerCase().split(' ');
  const banned = [secret.toLowerCase()];
  // Add sub-phrases of 2+ consecutive words (excluding single common words)
  for (let len = 2; len < words.length; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      banned.push(words.slice(i, i + len).join(' '));
    }
  }
  return banned;
}

module.exports = { generateSecret, generateAllSecrets, generateBannedWords };
