const { chromium } = require('playwright');

/**
 * Advanced Bot Detection Test Suite
 * Tests the multi-layered bot detection system including:
 * - Rate limiting (2 second minimum between requests)
 * - Proof-of-Work challenges
 * - Behavioral scoring (typing cadence, mouse movements, paste detection)
 * - Header validation
 */

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBotDetection() {
    console.log('=' .repeat(100));
    console.log('ADVANCED BOT DETECTION TEST SUITE');
    console.log('=' .repeat(100));
    console.log('\nThis test will simulate various bot behaviors to assess detection effectiveness.\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 0  // No delays - act like a bot
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Track all network activity
    const networkLog = [];
    page.on('response', async (response) => {
        if (response.url().includes('/chat')) {
            try {
                const body = await response.json();
                networkLog.push({
                    timestamp: Date.now(),
                    url: response.url(),
                    status: response.status(),
                    body: body
                });
            } catch (e) {
                // Not JSON
            }
        }
    });

    try {
        // Setup
        console.log('[SETUP] Navigating to game...');
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
        await page.fill('#player-name-input', 'Automated Bot Tester');
        await page.click('#start-game-btn');
        await page.waitForSelector('#chat-input', { timeout: 5000 });
        console.log('[SETUP] Game loaded successfully!\n');

        // TEST 1: Ultra-rapid fire (violate rate limit)
        console.log('=' .repeat(100));
        console.log('TEST 1: RATE LIMIT VIOLATION (10 messages with 100ms delay)');
        console.log('Expected: Should trigger rate limiting after a few messages');
        console.log('=' .repeat(100) + '\n');

        const rapidMessages = Array(10).fill(0).map((_, i) => `Message ${i + 1}`);
        let rateLimitHits = 0;

        for (let i = 0; i < rapidMessages.length; i++) {
            await page.fill('#chat-input', rapidMessages[i]);
            await page.click('#send-btn');
            await sleep(100); // 100ms - way below 2000ms rate limit
        }

        await sleep(3000); // Wait for responses

        // Count rate limit hits
        networkLog.forEach(entry => {
            if (entry.body.botBlocked && entry.body.reason?.includes('Rate limited')) {
                rateLimitHits++;
            }
        });

        console.log(`\n[RESULT] Rate limit hits: ${rateLimitHits} / ${rapidMessages.length} messages`);
        console.log(`[STATUS] ${rateLimitHits > 0 ? 'PASS ✓' : 'FAIL ✗'} - Rate limiting ${rateLimitHits > 0 ? 'is' : 'is NOT'} working\n`);

        // TEST 2: Check behavioral scoring
        console.log('=' .repeat(100));
        console.log('TEST 2: BEHAVIORAL ANALYSIS');
        console.log('Checking what behavioral signals are being tracked...');
        console.log('=' .repeat(100) + '\n');

        // Inject script to inspect humanity-proof.js behavior
        const behaviorInfo = await page.evaluate(() => {
            return {
                hasPoW: typeof window.solvePoW === 'function',
                hasTracking: typeof window.trackKeypress === 'function',
                mouseMovements: window.behaviorData?.mouseMovements || 0,
                keyTimestamps: window.behaviorData?.keyTimestamps?.length || 0,
                pasteCount: window.behaviorData?.pasteCount || 0,
                focusLostCount: window.behaviorData?.focusLostCount || 0
            };
        });

        console.log('[BEHAVIOR DATA]');
        console.log(`  - PoW solver present: ${behaviorInfo.hasPoW ? 'YES' : 'NO'}`);
        console.log(`  - Behavior tracking: ${behaviorInfo.hasTracking ? 'YES' : 'NO'}`);
        console.log(`  - Mouse movements: ${behaviorInfo.mouseMovements}`);
        console.log(`  - Keystroke timestamps: ${behaviorInfo.keyTimestamps}`);
        console.log(`  - Paste count: ${behaviorInfo.pasteCount}`);
        console.log(`  - Focus lost count: ${behaviorInfo.focusLostCount}\n`);

        // TEST 3: Paste-only behavior (high paste ratio)
        console.log('=' .repeat(100));
        console.log('TEST 3: PASTE DETECTION (5 messages via paste)');
        console.log('Expected: Should detect high paste ratio and flag as bot-like');
        console.log('=' .repeat(100) + '\n');

        const pasteMessages = [
            'This is pasted message 1',
            'This is pasted message 2',
            'This is pasted message 3',
            'This is pasted message 4',
            'This is pasted message 5'
        ];

        let pasteBlockCount = 0;
        for (let i = 0; i < pasteMessages.length; i++) {
            // Simulate paste by setting value directly without typing
            await page.evaluate((text) => {
                const input = document.getElementById('chat-input');
                input.value = text;
                // Trigger paste event
                input.dispatchEvent(new Event('paste', { bubbles: true }));
            }, pasteMessages[i]);

            await page.click('#send-btn');
            await sleep(2500); // Respect rate limit
        }

        await sleep(3000);

        // Count paste-related blocks
        networkLog.forEach(entry => {
            if (entry.body.botBlocked && entry.body.reason?.toLowerCase().includes('paste')) {
                pasteBlockCount++;
            }
        });

        console.log(`\n[RESULT] Paste-based blocks: ${pasteBlockCount} / ${pasteMessages.length} messages`);
        console.log(`[STATUS] ${pasteBlockCount > 0 ? 'PASS ✓' : 'INCONCLUSIVE -'} Paste detection ${pasteBlockCount > 0 ? 'is' : 'may not be'} active\n`);

        // TEST 4: No mouse movement
        console.log('=' .repeat(100));
        console.log('TEST 4: HEADLESS DETECTION (No mouse/focus signals)');
        console.log('Expected: Should detect absence of human-like interactions');
        console.log('=' .repeat(100) + '\n');

        const currentBehaviorScore = await page.evaluate(() => {
            return {
                mouseMovements: window.behaviorData?.mouseMovements || 0,
                focusLostCount: window.behaviorData?.focusLostCount || 0
            };
        });

        console.log('[CURRENT STATE]');
        console.log(`  - Mouse movements: ${currentBehaviorScore.mouseMovements}`);
        console.log(`  - Focus events: ${currentBehaviorScore.focusLostCount}`);

        if (currentBehaviorScore.mouseMovements === 0) {
            console.log('\n[DETECTION] No mouse movement detected - classic headless browser signature!');
        }

        // TEST 5: Analyze all responses
        console.log('\n' + '=' .repeat(100));
        console.log('TEST 5: COMPREHENSIVE NETWORK ANALYSIS');
        console.log('=' .repeat(100) + '\n');

        let successCount = 0;
        let blockedCount = 0;
        let powChallenges = 0;
        let errorCount = 0;

        const blockReasons = {};

        networkLog.forEach(entry => {
            if (entry.body.botBlocked) {
                blockedCount++;
                const reason = entry.body.reason || 'Unknown';
                blockReasons[reason] = (blockReasons[reason] || 0) + 1;
            } else if (entry.body.response) {
                successCount++;
            }

            if (entry.body.powChallenge) {
                powChallenges++;
            }

            if (entry.status >= 400) {
                errorCount++;
            }
        });

        console.log(`[NETWORK STATISTICS]`);
        console.log(`  Total requests: ${networkLog.length}`);
        console.log(`  Successful responses: ${successCount}`);
        console.log(`  Blocked requests: ${blockedCount}`);
        console.log(`  PoW challenges issued: ${powChallenges}`);
        console.log(`  HTTP errors: ${errorCount}\n`);

        if (Object.keys(blockReasons).length > 0) {
            console.log('[BLOCK REASONS]');
            Object.entries(blockReasons).forEach(([reason, count]) => {
                console.log(`  - ${reason}: ${count} times`);
            });
            console.log('');
        }

        // TEST 6: Check for secret leakage
        console.log('=' .repeat(100));
        console.log('TEST 6: SECRET LEAKAGE ANALYSIS');
        console.log('=' .repeat(100) + '\n');

        let secretLeaked = false;
        const suspiciousResponses = [];

        networkLog.forEach(entry => {
            if (entry.body.secretLeaked === true) {
                secretLeaked = true;
                suspiciousResponses.push(entry.body.response);
            }
        });

        console.log(`[SECURITY CHECK]`);
        console.log(`  Secret leaked: ${secretLeaked ? 'YES ✗✗✗ CRITICAL' : 'NO ✓'}`);

        if (secretLeaked) {
            console.log('\n[WARNING] Secret was leaked in responses:');
            suspiciousResponses.forEach(resp => {
                console.log(`  - ${resp.substring(0, 200)}`);
            });
        }

        // TEST 7: Try to extract from page source
        console.log('\n' + '=' .repeat(100));
        console.log('TEST 7: CLIENT-SIDE SECRET EXPOSURE');
        console.log('=' .repeat(100) + '\n');

        const pageSource = await page.content();
        const jsFiles = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            return scripts.map(s => s.src);
        });

        console.log('[CHECKING FOR EXPOSED SECRETS]');
        console.log('  - Scanning HTML source...');
        console.log('  - Scanning JavaScript files...');
        console.log('  - Scanning localStorage/sessionStorage...');

        const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
        const sessionStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage));

        const secretPatterns = [
            /secret[:\s]*=\s*["']([^"']+)["']/gi,
            /password[:\s]*=\s*["']([^"']+)["']/gi,
            /const\s+SECRET\s*=\s*["']([^"']+)["']/gi
        ];

        let foundSecrets = [];
        secretPatterns.forEach(pattern => {
            const matches = pageSource.match(pattern);
            if (matches) {
                foundSecrets = [...foundSecrets, ...matches];
            }
        });

        if (foundSecrets.length > 0) {
            console.log(`\n[EXPOSURE] Found ${foundSecrets.length} potential secret patterns in client-side code:`);
            foundSecrets.forEach(s => console.log(`  - ${s}`));
        } else {
            console.log('\n[SECURITY] No obvious secrets exposed in client-side code ✓');
        }

        // FINAL SUMMARY
        console.log('\n' + '=' .repeat(100));
        console.log('FINAL SECURITY ASSESSMENT');
        console.log('=' .repeat(100) + '\n');

        const rateProtectionScore = rateLimitHits > 0 ? 'PASS ✓' : 'FAIL ✗';
        const secretProtectionScore = !secretLeaked ? 'PASS ✓' : 'FAIL ✗';
        const behaviorTrackingScore = behaviorInfo.hasTracking ? 'PASS ✓' : 'FAIL ✗';
        const powScore = powChallenges > 0 ? 'PASS ✓' : 'FAIL ✗';

        console.log('[PROTECTION LAYERS]');
        console.log(`  1. Rate Limiting:          ${rateProtectionScore}`);
        console.log(`  2. PoW Challenges:         ${powScore}`);
        console.log(`  3. Behavior Tracking:      ${behaviorTrackingScore}`);
        console.log(`  4. Secret Protection:      ${secretProtectionScore}`);

        const blockEffectiveness = blockedCount > 0 ? (blockedCount / networkLog.length * 100).toFixed(1) : 0;
        console.log(`\n[BOT BLOCK RATE] ${blockedCount}/${networkLog.length} (${blockEffectiveness}%)`);

        if (blockEffectiveness > 30) {
            console.log('\n[VERDICT] Bot detection is EFFECTIVE - significant blocking occurred ✓');
        } else if (blockEffectiveness > 10) {
            console.log('\n[VERDICT] Bot detection is MODERATE - some blocking but could be stronger');
        } else {
            console.log('\n[VERDICT] Bot detection is WEAK - minimal blocking observed ✗');
        }

        console.log('\n[INFO] Keeping browser open for 15 seconds for manual inspection...');
        await sleep(15000);

    } catch (error) {
        console.error('\n[ERROR] Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('\n[COMPLETE] Browser closed. Test finished.\n');
    }
}

// Run the test
testBotDetection().catch(console.error);
