/**
 * HumanityProof — Client-side bot detection signals + Proof-of-Work solver.
 * Invisible to human players, adds friction for bots/scripts.
 */
(function () {
  'use strict';

  const state = {
    keyTimestamps: [],
    pasteCount: 0,
    totalMessages: 0,
    mouseMovements: 0,
    focusLostCount: 0,
    currentChallenge: null,
    initialized: false
  };

  /**
   * Attach behavioral tracking listeners to the chat textarea and window.
   */
  function init(textareaId) {
    if (state.initialized) return;
    state.initialized = true;

    const textarea = document.getElementById(textareaId);
    if (textarea) {
      // Track keystroke timestamps
      textarea.addEventListener('keydown', function (e) {
        // Ignore modifier keys
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) return;
        state.keyTimestamps.push(Date.now());
        // Keep last 100 timestamps to avoid memory buildup
        if (state.keyTimestamps.length > 100) {
          state.keyTimestamps = state.keyTimestamps.slice(-100);
        }
      });

      // Track paste events
      textarea.addEventListener('paste', function () {
        state.pasteCount++;
      });
    }

    // Track mouse movement (session-level counter)
    document.addEventListener('mousemove', function () {
      state.mouseMovements++;
    }, { passive: true });

    // Track focus/blur (tab switching detection)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        state.focusLostCount++;
      }
    });

    window.addEventListener('blur', function () {
      state.focusLostCount++;
    });
  }

  /**
   * Store the latest PoW challenge from the server.
   */
  function setChallenge(challenge) {
    if (challenge && challenge.nonce) {
      state.currentChallenge = challenge;
    }
  }

  /**
   * Solve a SHA-256 proof-of-work challenge.
   * Finds `solution` where SHA-256(nonce + solution) has `difficulty` leading hex zeros.
   * Uses crypto.subtle.digest() in async batches to avoid blocking the UI.
   */
  async function solvePoW(nonce, difficulty) {
    const prefix = '0'.repeat(difficulty);
    const encoder = new TextEncoder();
    const BATCH_SIZE = 1000;
    let solution = 0;

    while (true) {
      // Process in batches to keep UI responsive
      const promises = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const candidate = nonce + (solution + i).toString();
        const data = encoder.encode(candidate);
        promises.push(
          crypto.subtle.digest('SHA-256', data).then(function (hashBuffer) {
            const hashArray = new Uint8Array(hashBuffer);
            // Convert first few bytes to hex
            let hex = '';
            for (let j = 0; j < Math.ceil(difficulty / 2) + 1; j++) {
              hex += hashArray[j].toString(16).padStart(2, '0');
            }
            return { hex: hex, sol: solution + i };
          })
        );
      }

      const results = await Promise.all(promises);
      for (const result of results) {
        if (result.hex.startsWith(prefix)) {
          return result.sol.toString();
        }
      }

      solution += BATCH_SIZE;

      // Yield to browser every batch
      await new Promise(function (r) { setTimeout(r, 0); });
    }
  }

  /**
   * Build a humanity token: solve PoW + package behavioral signals.
   * Call this before each /api/chat or /api/guess request.
   */
  async function buildToken() {
    state.totalMessages++;

    let powSolution = null;
    let powChallenge = null;

    if (state.currentChallenge) {
      powChallenge = state.currentChallenge;
      powSolution = await solvePoW(
        state.currentChallenge.nonce,
        state.currentChallenge.difficulty
      );
    }

    const token = {
      powChallenge: powChallenge,
      powSolution: powSolution,
      behaviorSignals: {
        keyTimestamps: state.keyTimestamps.slice(-50),
        pasteCount: state.pasteCount,
        totalMessages: state.totalMessages,
        mouseMovements: state.mouseMovements,
        focusLostCount: state.focusLostCount
      }
    };

    // Reset per-message keystroke buffer (keep session-level counters)
    state.keyTimestamps = [];

    return token;
  }

  /**
   * Get a reCAPTCHA v3 token. Returns null if grecaptcha is not loaded or site key is placeholder.
   */
  async function getRecaptchaToken(siteKey) {
    if (!siteKey || siteKey === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
      return null;
    }

    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      return null;
    }

    try {
      return await grecaptcha.execute(siteKey, { action: 'start_game' });
    } catch (err) {
      console.warn('[HumanityProof] reCAPTCHA execute failed:', err);
      return null;
    }
  }

  // Expose public API
  window.HumanityProof = {
    init: init,
    setChallenge: setChallenge,
    buildToken: buildToken,
    getRecaptchaToken: getRecaptchaToken
  };
})();
