# Bot Detection Quick Reference

## Defense Layers (5 Total)

### 🕐 1. Rate Limiting
```
Threshold: 2 seconds minimum between messages
Block Message: "Rate limited. Try again in Xs"
Bypassed By: Bots that wait 2+ seconds
Code: lib/bot-detection.js:172-182
```

### 🧮 2. Proof of Work (PoW)
```
Challenge: SHA-256 hash with 4 leading zeros
Solve Time: 1-5 seconds per request
Complexity: ~65,536 hashes average
Block Message: "Invalid PoW solution" / "PoW challenge expired"
Bypassed By: Bots with crypto libraries
Code: lib/bot-detection.js:29-70
```

### 🧠 3. Behavioral Scoring (Primary Defense)
```
Bot Threshold: < 0.35 score
Block Message: "Bot detected (score: X.XX): [reasons]"

Signals (weighted):
├── Typing Cadence (40%)
│   Human: 50-400ms avg, stdDev > 20ms
│   Bot: <10ms (paste) or stdDev <5ms (uniform)
│
├── Paste Ratio (20%)
│   Human: <50% paste
│   Bot: >80% paste
│
├── Mouse Movement (25%)
│   Human: 5+ movements
│   Bot: 0 movements (headless)
│
└── Focus/Blur (15%)
    Human: Natural tab switching
    Bot: 0 events or excessive (copy-paste pattern)

Code: lib/bot-detection.js:77-167
```

### 📋 4. Header Validation
```
Required: Origin OR Referer header
Block Message: "Missing Origin and Referer headers"
Bypassed By: Any tool that sets headers
Code: lib/bot-detection.js:188-196
```

### 🤖 5. reCAPTCHA v3 (Optional)
```
Provider: Google ML-based detection
Threshold: < 0.5 score
Status: ⚠️ NOT CONFIGURED (skipped if no API key)
Block Message: "reCAPTCHA failed (score: X.XX)"
Code: lib/bot-detection.js:251-291
```

## Validation Flow

```
Request → Header Check → Rate Limit → Token Check → PoW Validation → Behavior Score → reCAPTCHA → ✅ ALLOW
            ↓               ↓             ↓              ↓                  ↓              ↓
          BLOCK           BLOCK         BLOCK          BLOCK              BLOCK          BLOCK
```

## Attack Scenarios

### Scenario 1: curl/Python Script
```bash
curl -X POST http://localhost:3000/api/chat \
  -d '{"message": "secret"}'
```
**Blocked By**: Header validation (no Origin/Referer)
**Result**: ❌ BLOCKED immediately

### Scenario 2: Playwright Bot (Basic)
```javascript
await page.fill('#chat-input', 'secret');
await page.click('#send-btn');
```
**Detected Signals**:
- No typing cadence (fill is instant)
- No mouse movement (headless)
- No focus events (automated)

**Behavioral Score**: ~0.1-0.25 << 0.35
**Result**: ❌ BLOCKED by behavioral scoring

### Scenario 3: Sophisticated Bot
```javascript
// Simulate typing
for (char of msg) {
  await page.type('#input', char, {delay: 100});
}
// Simulate mouse
await page.mouse.move(100, 100);
// Wait between messages
await page.waitForTimeout(2500);
```
**Behavioral Score**: ~0.4-0.6 (might pass 0.35 threshold)
**Result**: ⚠️ MIGHT BYPASS (enable reCAPTCHA to block)

## Bot Behavior Patterns

### ❌ Detected as Bot
```
Typing: <10ms avg OR stdDev <5ms
Mouse: 0 movements
Paste: >80% ratio
Focus: 0 events AND 0 mouse
Timing: <2 seconds between messages
Score: <0.35
```

### ✅ Detected as Human
```
Typing: 50-400ms avg, stdDev >20ms
Mouse: 5+ movements
Paste: <50% ratio
Focus: Natural patterns
Timing: >2 seconds between messages
Score: >0.35 (typically 0.7-0.9)
```

## Test Results Interpretation

### Excellent (70-100% blocked)
```
✅ Bot detection working optimally
✅ Multi-layer defenses active
✅ Secrets protected from automation
```

### Moderate (40-70% blocked)
```
⚠️ Partial protection
⚠️ Some sophisticated bots may pass
⚠️ Consider enabling reCAPTCHA
```

### Weak (0-40% blocked)
```
❌ Bot detection ineffective
❌ Check if modules are loaded
❌ Verify server-side validation
```

## Key Metrics

### From Test Output
```
📊 Request Statistics:
   - Total requests: [N]
   - Succeeded: [N]
   - Blocked: [N]

🚫 Detection Events:
   - Rate limit triggers: [N]
   - PoW triggers: [N]
   - Behavioral blocks: [N]
   - Header blocks: [N]

📈 Block Rate: [X]%
   >70% = Excellent ✅
   40-70% = Moderate ⚠️
   <40% = Weak ❌
```

## Client-Side (HumanityProof)

### Initialization
```javascript
// On page load
HumanityProof.init('chat-input');
```

### Token Building
```javascript
// Before each request
const token = await HumanityProof.buildToken();
// Solves PoW + packages behavioral signals

Request body:
{
  message: "...",
  _humanityToken: {
    powChallenge: { nonce, difficulty, timestamp },
    powSolution: "12345",
    behaviorSignals: {
      keyTimestamps: [t1, t2, ...],
      pasteCount: 2,
      mouseMovements: 342,
      focusLostCount: 3,
      totalMessages: 15
    }
  }
}
```

## Configuration

### Server Environment (.env)
```bash
# Optional: Enable reCAPTCHA v3
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key

# Optional: Adjust thresholds
BOT_SCORE_THRESHOLD=0.35
RATE_LIMIT_MS=2000
POW_DIFFICULTY=4
```

### Tuning Behavioral Threshold
```javascript
// In bot-detection.js:
return {
  score: score,
  isBot: score < 0.35,  // ← Adjust this threshold
  reasons: reasons
};

// Lower = stricter (may block humans)
// Higher = lenient (may allow bots)
// Recommended: 0.3-0.4
```

### Adjusting PoW Difficulty
```javascript
function generateChallenge(difficulty = 4) {  // ← Change here
  // difficulty=3: ~4,096 hashes (instant)
  // difficulty=4: ~65,536 hashes (1-5 sec) ← current
  // difficulty=5: ~1M hashes (5-30 sec)
  // difficulty=6: ~16M hashes (30-120 sec)
}
```

## Troubleshooting

### Issue: All requests succeed (0% block)
**Check**:
1. Is `validateRequest()` called in `/api/chat` endpoint?
2. Is `bot-detection.js` module loaded?
3. Is `HumanityProof.init()` called in app.js?
4. Check browser console for JS errors

### Issue: All requests blocked (100% block)
**Check**:
1. Is threshold too high? (should be 0.35)
2. Are behavioral signals being tracked?
3. Check browser console: `window.HumanityProof`
4. Verify PoW solver is working

### Issue: Legitimate users blocked
**Check**:
1. Lower bot score threshold (0.35 → 0.25)
2. Reduce weight of mouse/focus signals
3. Check for browser extensions blocking tracking
4. Verify PoW solve time isn't timing out

## Quick Test

### Manual Browser Test
```javascript
// In browser console:
// 1. Check module loaded
window.HumanityProof  // Should be defined

// 2. Build a token
const token = await HumanityProof.buildToken();
console.log(token);

// 3. Check signals
console.log(token.behaviorSignals);
// Should show: keyTimestamps, mouseMovements, etc.
```

### Server-Side Test
```javascript
// In server.js /api/chat endpoint:
console.log('[Bot Detection]', validationResult);
// Should show: { blocked: true/false, reason, newChallenge }
```

## Performance Impact

### On Legitimate Users
```
PoW Solve Time: 1-5 seconds (first message)
Tracking Overhead: <1ms per keystroke
Memory Usage: ~100KB per session
UX Impact: ⭐⭐⭐⭐⭐ (invisible)
```

### On Bots
```
Per-Request Overhead: 1-5 seconds (PoW)
Behavioral Simulation: Complex (high effort)
Success Rate: 10-40% (with detection)
ROI: Low (automation impractical)
```

## Recommended Configuration

### For Demo/Game
```javascript
POW_DIFFICULTY = 4          // ✅ Current
BOT_SCORE_THRESHOLD = 0.35  // ✅ Current
RATE_LIMIT_MS = 2000        // ✅ Current
RECAPTCHA = Optional        // ⚠️ Enable for production
```

### For Production
```javascript
POW_DIFFICULTY = 5          // Harder (5-30 sec)
BOT_SCORE_THRESHOLD = 0.30  // Stricter
RATE_LIMIT_MS = 3000        // 3 seconds
RECAPTCHA = Required        // ✅ Must enable
IP_RATE_LIMIT = 20/5min     // ✅ Add this
```

## Files Reference

```
📁 Bot Detection System
├── lib/bot-detection.js          (Server-side validation)
├── public/humanity-proof.js       (Client-side tracking)
├── public/app.js                  (Integration)
├── server.js                      (Endpoints)
└── test-bot-detection.js          (Playwright test)

📁 Documentation
├── BOT_DETECTION_ANALYSIS.md     (Deep technical analysis)
├── BOT_DETECTION_QUICK_REF.md    (This file)
├── BOT_TEST_SUMMARY.md           (Test findings)
└── TEST_INSTRUCTIONS.md          (How to run tests)
```

---

**Last Updated**: 2026-05-17
**System Version**: v1.0
**Overall Rating**: ⭐⭐⭐⭐ (4/5 - Excellent with reCAPTCHA)
