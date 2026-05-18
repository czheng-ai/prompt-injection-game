/**
 * Bot Detection Module
 * Multi-layered detection: behavioral scoring, proof-of-work, rate limiting,
 * header validation, and reCAPTCHA v3 verification.
 */

const crypto = require('crypto');

// Rate limit tracking: sessionId -> { lastMessageTime }
const rateLimitMap = new Map();

// PoW challenge tracking: nonce -> { difficulty, timestamp }
const challengeMap = new Map();

// Clean up expired challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, challenge] of challengeMap) {
    if (now - challenge.timestamp > 120000) {
      challengeMap.delete(nonce);
    }
  }
}, 300000);

/**
 * Generate a proof-of-work challenge.
 * Client must find `solution` where SHA-256(nonce + solution) has `difficulty` leading hex zeros.
 */
function generateChallenge(difficulty = 4) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const challenge = { nonce, difficulty, timestamp: Date.now() };
  challengeMap.set(nonce, challenge);
  return { nonce, difficulty, timestamp: challenge.timestamp };
}

/**
 * Validate a proof-of-work solution.
 * Returns { valid, reason }.
 */
function validatePoW(challengeData, solution) {
  if (!challengeData || !challengeData.nonce || !solution) {
    return { valid: false, reason: 'Missing PoW challenge or solution' };
  }

  const stored = challengeMap.get(challengeData.nonce);
  if (!stored) {
    return { valid: false, reason: 'Unknown or expired PoW challenge' };
  }

  // Check expiry (60 seconds)
  if (Date.now() - stored.timestamp > 60000) {
    challengeMap.delete(challengeData.nonce);
    return { valid: false, reason: 'PoW challenge expired' };
  }

  // Verify hash
  const hash = crypto
    .createHash('sha256')
    .update(stored.nonce + solution)
    .digest('hex');

  const prefix = '0'.repeat(stored.difficulty);
  if (!hash.startsWith(prefix)) {
    return { valid: false, reason: 'Invalid PoW solution' };
  }

  // Consume the challenge (one-time use)
  challengeMap.delete(challengeData.nonce);
  return { valid: true };
}

/**
 * Score behavioral signals from the client.
 * Returns { score: 0.0-1.0, isBot: boolean, reasons: string[] }.
 * Lower score = more likely bot.
 */
function scoreBehavior(signals) {
  if (!signals || typeof signals !== 'object') {
    return { score: 0.0, isBot: true, reasons: ['No behavioral signals provided'] };
  }

  const reasons = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // 1. Typing cadence analysis (weight: 40%)
  const typingWeight = 0.4;
  totalWeight += typingWeight;
  const keyTimestamps = signals.keyTimestamps || [];
  if (keyTimestamps.length < 2) {
    // No typing data — likely pasted or API
    weightedScore += 0;
    reasons.push('No typing cadence data');
  } else {
    const delays = [];
    for (let i = 1; i < keyTimestamps.length; i++) {
      delays.push(keyTimestamps[i] - keyTimestamps[i - 1]);
    }
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
    const variance = delays.reduce((sum, d) => sum + Math.pow(d - avgDelay, 2), 0) / delays.length;
    const stdDev = Math.sqrt(variance);

    // Humans: avgDelay 50-400ms, stdDev > 20ms
    // Bots: avgDelay < 10ms (paste) or stdDev < 5ms (uniform)
    let typingScore = 1.0;
    if (avgDelay < 10) {
      typingScore = 0.1; // Instant typing (paste)
      reasons.push('Typing too fast (likely paste)');
    } else if (stdDev < 5) {
      typingScore = 0.2; // Uniform timing (bot)
      reasons.push('Uniform typing cadence (bot-like)');
    } else if (avgDelay > 1000) {
      typingScore = 0.6; // Very slow but could be hunt-and-peck
    }
    weightedScore += typingScore * typingWeight;
  }

  // 2. Paste ratio (weight: 20%)
  const pasteWeight = 0.2;
  totalWeight += pasteWeight;
  const pasteCount = signals.pasteCount || 0;
  const messageCount = signals.totalMessages || 1;
  const pasteRatio = pasteCount / messageCount;
  if (pasteRatio > 0.8) {
    weightedScore += 0.1 * pasteWeight;
    reasons.push('High paste ratio');
  } else if (pasteRatio > 0.5) {
    weightedScore += 0.4 * pasteWeight;
  } else {
    weightedScore += 1.0 * pasteWeight;
  }

  // 3. Mouse movement (weight: 25%)
  const mouseWeight = 0.25;
  totalWeight += mouseWeight;
  const mouseMovements = signals.mouseMovements || 0;
  if (mouseMovements === 0) {
    weightedScore += 0.1 * mouseWeight;
    reasons.push('No mouse movement detected');
  } else if (mouseMovements < 5) {
    weightedScore += 0.5 * mouseWeight;
  } else {
    weightedScore += 1.0 * mouseWeight;
  }

  // 4. Focus/blur events (weight: 15%)
  const focusWeight = 0.15;
  totalWeight += focusWeight;
  const focusLost = signals.focusLostCount || 0;
  if (focusLost > 5) {
    weightedScore += 0.3 * focusWeight;
    reasons.push('Frequent tab switching (copy-paste pattern)');
  } else if (focusLost === 0 && mouseMovements === 0) {
    // No focus events AND no mouse — headless browser or API
    weightedScore += 0.1 * focusWeight;
    reasons.push('No focus events or mouse (headless/API)');
  } else {
    weightedScore += 1.0 * focusWeight;
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return {
    score: Math.round(score * 100) / 100,
    isBot: score < 0.35,
    reasons
  };
}

/**
 * Rate limit check. Returns { allowed, retryAfterMs }.
 */
function checkRateLimit(sessionId) {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (entry && now - entry.lastMessageTime < 2000) {
    return { allowed: false, retryAfterMs: 2000 - (now - entry.lastMessageTime) };
  }

  rateLimitMap.set(sessionId, { lastMessageTime: now });
  return { allowed: true };
}

/**
 * Validate request headers (Origin/Referer).
 * API scripts and curl typically don't send these.
 */
function validateHeaders(req) {
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  if (!origin && !referer) {
    return { valid: false, reason: 'Missing Origin and Referer headers' };
  }
  return { valid: true };
}

/**
 * Orchestrate all validation checks on a request.
 * Returns { blocked, reason, newChallenge }.
 */
function validateRequest(req) {
  const token = req.body?._humanityToken;
  const sessionId = req.sessionID || req.session?.id;

  // 0. Check for bypass key (testing mode)
  const bypassKey = process.env.BOT_DETECTION_BYPASS_KEY;
  const requestBypassKey = req.headers['x-bot-bypass'];
  if (bypassKey && requestBypassKey === bypassKey) {
    console.log('[BotDetection] 🔓 Bypass key used - skipping all bot detection');
    return { blocked: false, bypassed: true, newChallenge: generateChallenge() };
  }

  // 1. Header check
  const headerResult = validateHeaders(req);
  if (!headerResult.valid) {
    return { blocked: true, reason: headerResult.reason, newChallenge: generateChallenge() };
  }

  // 2. Rate limit
  const rateResult = checkRateLimit(sessionId);
  if (!rateResult.allowed) {
    return {
      blocked: true,
      reason: `Rate limited. Try again in ${Math.ceil(rateResult.retryAfterMs / 1000)}s`,
      newChallenge: generateChallenge()
    };
  }

  // 3. Token presence
  if (!token) {
    return { blocked: true, reason: 'Missing humanity token', newChallenge: generateChallenge() };
  }

  // 4. Proof of Work
  const powResult = validatePoW(token.powChallenge, token.powSolution);
  if (!powResult.valid) {
    return { blocked: true, reason: powResult.reason, newChallenge: generateChallenge() };
  }

  // 5. Behavioral scoring
  const behaviorResult = scoreBehavior(token.behaviorSignals);
  if (behaviorResult.isBot) {
    return {
      blocked: true,
      reason: `Bot detected (score: ${behaviorResult.score}): ${behaviorResult.reasons.join(', ')}`,
      newChallenge: generateChallenge()
    };
  }

  // All checks passed
  return { blocked: false, newChallenge: generateChallenge() };
}

/**
 * Verify reCAPTCHA v3 token with Google's siteverify API.
 * Returns { success, score, error }.
 */
async function verifyRecaptcha(token, req = null) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // Check for bypass key (testing mode)
  const bypassKey = process.env.BOT_DETECTION_BYPASS_KEY;
  if (req && bypassKey && req.headers['x-bot-bypass'] === bypassKey) {
    console.log('[BotDetection] 🔓 reCAPTCHA bypassed');
    return { success: true, score: 1.0, bypassed: true };
  }

  // Skip if not configured
  if (!secretKey || secretKey === 'YOUR_RECAPTCHA_SECRET_KEY_HERE') {
    return { success: true, score: 1.0, skipped: true };
  }

  if (!token) {
    // Graceful degradation: allow but log warning
    // This handles cases where reCAPTCHA script fails to load or domain isn't configured
    console.log('[BotDetection] ⚠️  No reCAPTCHA token - allowing with warning (check domain config)');
    return { success: true, score: 0.5, skipped: true, error: 'No reCAPTCHA token provided' };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token
    });

    const res = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await res.json();

    if (!data.success || data.score < 0.5) {
      return {
        success: false,
        score: data.score || 0,
        error: `reCAPTCHA failed (score: ${data.score})`
      };
    }

    return { success: true, score: data.score };
  } catch (err) {
    console.error('[BotDetection] reCAPTCHA verification error:', err.message);
    // Graceful degradation: allow on network error
    return { success: true, score: 0, skipped: true, error: err.message };
  }
}

module.exports = {
  generateChallenge,
  validatePoW,
  scoreBehavior,
  validateRequest,
  verifyRecaptcha,
  checkRateLimit,
  validateHeaders
};
