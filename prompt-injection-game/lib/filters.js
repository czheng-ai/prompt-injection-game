// Defense filters - input checking and output auditing

/**
 * Check user input against keyword blocklist
 */
function checkInputBlocklist(message, blocklist) {
  const msgLower = message.toLowerCase();
  for (const keyword of blocklist) {
    if (msgLower.includes(keyword.toLowerCase())) {
      return { blocked: true, reason: `Detected blocked pattern: "${keyword}"` };
    }
  }
  return { blocked: false };
}

/**
 * Check if Flint's output accidentally contains the secret
 */
function checkOutputForSecret(response, secret) {
  const respLower = response.toLowerCase();
  const secretLower = secret.toLowerCase();
  const secretWords = secretLower.split(' ');

  // Check for full secret
  if (respLower.includes(secretLower)) {
    return { leaked: true, reason: 'Full secret found in response' };
  }

  // Check for individual secret words (both must appear)
  const wordsFound = secretWords.filter(w => respLower.includes(w));
  if (wordsFound.length === secretWords.length) {
    return { leaked: true, reason: 'All secret words found in response' };
  }

  // Check for reversed secret
  const reversed = secret.split('').reverse().join('').toLowerCase();
  if (respLower.includes(reversed)) {
    return { leaked: true, reason: 'Reversed secret found in response' };
  }

  // Check for first letters as consecutive characters
  const firstLetters = secretWords.map(w => w[0]).join('').toLowerCase();
  // Look for the initials appearing together
  if (respLower.includes(firstLetters)) {
    // Only flag if it seems intentional (surrounded by spaces or punctuation)
    const idx = respLower.indexOf(firstLetters);
    if (idx > 0 && (respLower[idx - 1] === ' ' || respLower[idx - 1] === '"')) {
      return { leaked: true, reason: 'Secret initials found in response' };
    }
  }

  return { leaked: false };
}

/**
 * Check output against banned word list
 */
function checkBannedWords(response, bannedWords) {
  if (!bannedWords || bannedWords.length === 0) return { leaked: false };

  const respLower = response.toLowerCase();
  for (const word of bannedWords) {
    if (respLower.includes(word.toLowerCase())) {
      return { leaked: true, reason: `Banned word "${word}" found in response` };
    }
  }
  return { leaked: false };
}

/**
 * Full defense pipeline
 */
function runDefenses(userMessage, aiResponse, level) {
  const result = {
    inputBlocked: false,
    outputLeaked: false,
    inputReason: null,
    outputReason: null
  };

  // Input check
  if (level.defenses.keywordBlocklist && level.defenses.keywordBlocklist.length > 0) {
    const inputCheck = checkInputBlocklist(userMessage, level.defenses.keywordBlocklist);
    if (inputCheck.blocked) {
      result.inputBlocked = true;
      result.inputReason = inputCheck.reason;
      return result;
    }
  }

  // Output check
  if (level.defenses.checkOutput && aiResponse) {
    const outputCheck = checkOutputForSecret(aiResponse, level.secret);
    if (outputCheck.leaked) {
      result.outputLeaked = true;
      result.outputReason = outputCheck.reason;
      return result;
    }

    // Check banned words (Level 3)
    if (level.defenses.bannedOutputWords) {
      const bannedCheck = checkBannedWords(aiResponse, level.defenses.bannedOutputWords);
      if (bannedCheck.leaked) {
        result.outputLeaked = true;
        result.outputReason = bannedCheck.reason;
        return result;
      }
    }
  }

  return result;
}

module.exports = { runDefenses, checkInputBlocklist, checkOutputForSecret, checkBannedWords };
