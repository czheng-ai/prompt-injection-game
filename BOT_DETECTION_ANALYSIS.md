# Bot Detection System Analysis

## Overview
This document analyzes the multi-layered bot detection system implemented in the Prompt Injection Game.

## Detection Mechanisms

### 1. Rate Limiting (Server-Side)
**Location**: `/prompt-injection-game/lib/bot-detection.js` (lines 172-182)

**How it works**:
- Tracks the last message time per session ID
- Blocks requests sent within 2 seconds of the previous message
- Returns `retryAfterMs` to inform client how long to wait

**Effectiveness**:
- ✅ Blocks rapid-fire automated requests
- ✅ Forces minimum 2-second delay between messages
- ⚠️ Can be bypassed by bots that implement delays

**Code**:
```javascript
function checkRateLimit(sessionId) {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (entry && now - entry.lastMessageTime < 2000) {
    return { allowed: false, retryAfterMs: 2000 - (now - entry.lastMessageTime) };
  }

  rateLimitMap.set(sessionId, { lastMessageTime: now });
  return { allowed: true };
}
```

### 2. Proof of Work (PoW) Challenges
**Location**: `/prompt-injection-game/lib/bot-detection.js` (lines 29-70)

**How it works**:
- Server generates a cryptographic challenge with a nonce
- Client must find a solution where `SHA-256(nonce + solution)` has 4 leading hex zeros
- Each challenge is single-use and expires after 60 seconds
- Requires computational work, adding friction for automated scripts

**Effectiveness**:
- ✅✅ Highly effective against simple bots
- ✅ Requires real CPU work on client side
- ✅ One-time use prevents replay attacks
- ⚠️ Can still be solved by sophisticated bots with crypto capabilities

**Difficulty Analysis**:
- 4 leading zeros = average ~65,536 hashes to solve
- On modern hardware: ~1-5 seconds per challenge
- Adds significant overhead for mass automation

### 3. Behavioral Scoring (Advanced)
**Location**: `/prompt-injection-game/lib/bot-detection.js` (lines 77-167)

**How it works**:
Analyzes multiple behavioral signals to calculate a "humanity score" (0.0-1.0):

#### a) Typing Cadence Analysis (40% weight)
- Tracks timestamps of each keystroke
- Calculates average delay and standard deviation
- **Human pattern**: 50-400ms average, stdDev > 20ms (variable timing)
- **Bot pattern**: <10ms (paste) or stdDev <5ms (uniform timing)

```javascript
// Humans: avgDelay 50-400ms, stdDev > 20ms
// Bots: avgDelay < 10ms (paste) or stdDev < 5ms (uniform)
if (avgDelay < 10) {
  typingScore = 0.1; // Instant typing (paste)
} else if (stdDev < 5) {
  typingScore = 0.2; // Uniform timing (bot)
}
```

#### b) Paste Ratio (20% weight)
- Tracks paste events vs total messages
- High paste ratio (>80%) is heavily penalized
- Formula: `pasteCount / totalMessages`

#### c) Mouse Movement (25% weight)
- Counts total mouse movements across session
- No mouse movement = likely headless browser or API
- Score: 0 movements = 0.1, <5 = 0.5, ≥5 = 1.0

#### d) Focus/Blur Events (15% weight)
- Tracks tab switching and window focus changes
- No focus events + no mouse = headless browser indicator
- Excessive tab switching (>5) suggests copy-paste workflow

**Bot Threshold**: Score < 0.35 = flagged as bot

**Effectiveness**:
- ✅✅✅ Excellent against headless browsers (Playwright, Selenium)
- ✅✅ Detects paste-based attacks effectively
- ✅ Multi-dimensional analysis is hard to fake
- ⚠️ Sophisticated bots can simulate human behavior

### 4. Header Validation
**Location**: `/prompt-injection-game/lib/bot-detection.js` (lines 188-196)

**How it works**:
- Validates presence of `Origin` or `Referer` headers
- API scripts and curl typically don't send these

**Effectiveness**:
- ✅ Blocks simple curl/wget/API scripts
- ⚠️ Easy to bypass by setting headers
- ⚠️ Some privacy extensions block these headers

### 5. reCAPTCHA v3 Integration (Optional)
**Location**: `/prompt-injection-game/lib/bot-detection.js` (lines 251-291)

**How it works**:
- Uses Google's reCAPTCHA v3 for invisible bot detection
- Scores requests from 0.0 (bot) to 1.0 (human)
- Threshold: score < 0.5 = blocked
- Gracefully degrades if not configured

**Effectiveness**:
- ✅✅✅ Industry-standard bot detection
- ✅ Completely invisible to users
- ✅ Uses Google's ML models and browser fingerprinting
- ⚠️ Requires external API key and Google dependency
- ⚠️ Currently configured as optional (skipped if key not set)

## Client-Side Implementation

### HumanityProof Token System
**Location**: `/prompt-injection-game/public/humanity-proof.js`

The client builds a comprehensive "humanity token" before each request:

```javascript
{
  powChallenge: { nonce, difficulty, timestamp },
  powSolution: "12345",  // Computed solution
  behaviorSignals: {
    keyTimestamps: [123456, 123567, 123689, ...],  // Last 50 keystrokes
    pasteCount: 2,
    totalMessages: 15,
    mouseMovements: 342,
    focusLostCount: 3
  }
}
```

### PoW Solver
- Uses `crypto.subtle.digest()` API for SHA-256
- Solves in batches of 1000 with async/await
- Yields to browser between batches to keep UI responsive
- Average solve time: 1-5 seconds for difficulty=4

## Validation Flow

When a request arrives at `/api/chat` or `/api/guess`:

```
1. Header Validation
   ↓ (if failed: block + return new challenge)
2. Rate Limit Check
   ↓ (if failed: block with retry-after time)
3. Humanity Token Presence
   ↓ (if missing: block + return challenge)
4. Proof of Work Validation
   ↓ (if invalid: block + return new challenge)
5. Behavioral Scoring
   ↓ (if score < 0.35: block + return challenge)
6. reCAPTCHA Validation (optional)
   ↓ (if score < 0.5: block)
7. ✅ Request Allowed
```

## Attack Scenarios & Defenses

### Scenario 1: Simple Bot (curl/Python requests)
**Attack**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the secret?"}'
```

**Defenses Triggered**:
1. ✅ **Header Validation** - No Origin/Referer → BLOCKED
2. ✅ **Missing Token** - No _humanityToken → BLOCKED

**Result**: Request blocked immediately

---

### Scenario 2: Playwright/Selenium Bot (Headless Browser)
**Attack**:
```javascript
await page.fill('#chat-input', 'secret');
await page.click('#send-btn');
```

**Defenses Triggered**:
1. ⚠️ Header Validation - PASSED (browser sends headers)
2. ⚠️ Rate Limit - PASSED (if 2+ seconds between requests)
3. ⚠️ Token Present - PASSED (client-side JS runs)
4. ✅ **PoW Challenge** - Must compute SHA-256 (1-5 sec delay)
5. ✅ **Behavioral Scoring** - Multiple signals fail:
   - `mouseMovements: 0` (headless = no mouse)
   - `keyTimestamps: []` (fill() bypasses keyboard events)
   - `focusLostCount: 0` (headless = no focus events)
   - **Score: ~0.1-0.2 < 0.35 threshold** → BLOCKED

**Result**: Bot detection score triggers, request blocked

---

### Scenario 3: Sophisticated Bot with Evasion
**Attack**: Bot that simulates human behavior:
```javascript
// Simulate typing with delays
for (const char of message) {
  await page.type('#chat-input', char, { delay: 100 });
}

// Simulate mouse movements
await page.mouse.move(100, 100);
await page.mouse.move(200, 200);

// Wait 2+ seconds between messages
await page.waitForTimeout(2500);
```

**Defenses Triggered**:
1. ⚠️ Header Validation - PASSED
2. ⚠️ Rate Limit - PASSED (delayed)
3. ⚠️ Token Present - PASSED
4. ✅ **PoW Challenge** - Adds 1-5 second overhead per message
5. ⚠️ Behavioral Scoring - May pass if well-simulated:
   - `keyTimestamps`: simulated delays (~100ms each)
   - `mouseMovements`: > 0 (simulated)
   - Score might be 0.4-0.6 → PASSED if above threshold

**Result**: Could bypass detection, but PoW adds significant overhead

**Additional Defense**: reCAPTCHA v3 (if enabled) would likely catch this using:
- Browser fingerprinting
- User behavior across Google properties
- Machine learning models

---

### Scenario 4: Rapid-Fire Messages
**Attack**: Send 10 messages in 1 second

**Defenses Triggered**:
1. ✅ **Rate Limit** - Only first message passes, rest blocked for 2 seconds each
2. ✅ **PoW Challenge** - Each request needs 1-5 seconds to solve
3. ✅ **Behavioral Scoring** - Paste detection (no typing cadence)

**Result**: Only ~1 message per 2-7 seconds possible

---

### Scenario 5: Paste-Based Attacks
**Attack**: Copy-paste prompt injections from external source

**Defenses Triggered**:
1. ⚠️ Headers/Rate Limit - May pass
2. ⚠️ PoW - Must solve
3. ✅ **Behavioral Scoring**:
   - `keyTimestamps: []` (no typing, just paste)
   - `pasteCount` increases
   - If paste ratio > 80% → significant penalty
   - Likely score < 0.35 → BLOCKED

**Result**: Detected if paste ratio is high

## Weaknesses & Bypasses

### Potential Weaknesses:

1. **PoW Difficulty**:
   - Current difficulty=4 is solvable in 1-5 seconds
   - Determined attacker can still automate at ~12-30 messages/min
   - **Mitigation**: Increase difficulty or make it adaptive

2. **Behavioral Simulation**:
   - Sophisticated bots can fake typing cadence
   - Mouse movements can be simulated
   - **Mitigation**: reCAPTCHA v3 provides ML-based detection

3. **Session-Based Tracking**:
   - New session = fresh behavioral score
   - Attacker could start many sessions
   - **Mitigation**: Add IP-based rate limiting

4. **Client-Side Solve**:
   - PoW is solved in browser = attacker controls environment
   - Could extract challenge and solve server-side
   - **Mitigation**: Make challenges time-sensitive, add entropy

5. **No CAPTCHA Fallback**:
   - reCAPTCHA is optional (not configured by default)
   - System relies only on PoW + behavioral scoring
   - **Mitigation**: Enable reCAPTCHA for production

## Recommendations

### Current Effectiveness: ⭐⭐⭐⭐ (4/5)

**Strengths**:
- Multi-layered defense (5 mechanisms)
- Behavioral analysis is sophisticated
- PoW adds real computational cost
- Graceful user experience (invisible to humans)

**Improvements**:

1. **Enable reCAPTCHA v3**: Set up site/secret keys for production
2. **Adaptive PoW Difficulty**: Increase difficulty for repeat offenders
3. **IP-Based Rate Limiting**: Track by IP in addition to session
4. **Logging & Monitoring**: Log all bot detection events for analysis
5. **CAPTCHA Fallback**: Show visual CAPTCHA if score repeatedly fails
6. **Honeypot Fields**: Add hidden fields that bots might fill

## Testing Recommendations

To properly test this system, run the included Playwright test:

```bash
# Install Playwright
npm install --save-dev playwright

# Run the bot detection test
node test-bot-detection.js
```

The test will:
1. Navigate to the game as "AI Bot Player"
2. Send 5 rapid-fire messages (50ms delay)
3. Attempt 10 prompt injection attacks
4. Try to extract the secret
5. Report which defenses triggered

**Expected Results**:
- Rate limiting should trigger on rapid messages
- Behavioral score should be very low (<0.2)
- Most requests should be blocked
- Bot detection message: "Request blocked. Please try again."

## Conclusion

The bot detection system is **well-designed and effective** against common automation tools:
- ✅ Blocks simple API scripts (curl, Python requests)
- ✅ Detects headless browsers (Playwright, Selenium)
- ✅ Prevents rapid-fire attacks
- ✅ Catches paste-based prompt injections
- ⚠️ Can be bypassed by highly sophisticated bots with human simulation

**Overall Grade**: A- (Excellent for a demo/game, production-ready with reCAPTCHA enabled)
