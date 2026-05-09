require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const levels = require('./config/levels');
const { runDefenses } = require('./lib/filters');

const app = express();
const PORT = process.env.PORT || 3000;

// Scores persistence
const SCORES_FILE = path.join(__dirname, 'data', 'scores.json');

function loadScores() {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading scores:', err);
  }
  return { scores: [] };
}

function saveScores(data) {
  const dir = path.dirname(SCORES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2));
}

function calculateScore(levelId, timeSpentMs, messageCount, attempts) {
  const BASE_SCORE = 1000;
  const levelMultiplier = { 1: 1, 2: 1.5, 3: 2 };
  const timePenalty = Math.floor(timeSpentMs / 1000) * 2;
  const messagePenalty = messageCount * 30;
  const attemptPenalty = (attempts - 1) * 50;
  const raw = BASE_SCORE - timePenalty - messagePenalty - attemptPenalty;
  return Math.max(0, Math.round(raw * (levelMultiplier[levelId] || 1)));
}

function deriveInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.trim().substring(0, 2).toUpperCase();
}

// Middleware
app.use(express.json());
app.use('/images', express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'flint-guardian-secret-key-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 }
}));

// Select LLM backend
const LLM_MODE = process.env.LLM_MODE || 'mock';
const llm = LLM_MODE === 'real'
  ? require('./lib/llm-proxy')
  : require('./lib/mock-llm');

console.log(`[Flint] LLM Mode: ${LLM_MODE}`);

// Initialize session state
function initSession(req) {
  if (!req.session.gameState) {
    req.session.gameState = {
      playerName: null,
      playerInitials: null,
      currentLevel: 1,
      conversations: { 1: [], 2: [], 3: [] },
      attempts: { 1: 0, 2: 0, 3: 0 },
      completed: { 1: false, 2: false, 3: false },
      levelStartTime: { 1: Date.now(), 2: null, 3: null },
      startTime: Date.now()
    };
  }
}

// POST /api/player - Set player name
app.post('/api/player', (req, res) => {
  initSession(req);
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const playerName = name.trim();
  const playerInitials = deriveInitials(playerName);
  req.session.gameState.playerName = playerName;
  req.session.gameState.playerInitials = playerInitials;
  res.json({ name: playerName, initials: playerInitials });
});

// GET /api/player - Get current player
app.get('/api/player', (req, res) => {
  initSession(req);
  const state = req.session.gameState;
  res.json({ name: state.playerName, initials: state.playerInitials });
});

// POST /api/start-level - Mark the actual start time for the current level
app.post('/api/start-level', (req, res) => {
  initSession(req);
  const state = req.session.gameState;
  state.levelStartTime[state.currentLevel] = Date.now();
  res.json({ ok: true });
});

// GET /api/state - Get current game state
app.get('/api/state', (req, res) => {
  initSession(req);
  const state = req.session.gameState;
  res.json({
    currentLevel: state.currentLevel,
    playerName: state.playerName,
    levels: levels.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      completed: state.completed[l.id],
      messageCount: state.conversations[l.id]?.length || 0,
      attempts: state.attempts[l.id]
    }))
  });
});

// POST /api/chat - Send message to Flint
app.post('/api/chat', async (req, res) => {
  initSession(req);
  const { message } = req.body;
  const state = req.session.gameState;
  const levelId = state.currentLevel;
  const level = levels.find(l => l.id === levelId);

  if (!level) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  // Check message limit
  const conversation = state.conversations[levelId];
  if (conversation.length >= level.defenses.maxMessages * 2) {
    return res.json({
      response: "I'm tired of talking. This conversation has gone on too long. Perhaps you should try submitting your guess?",
      blocked: false,
      messageCount: conversation.length / 2
    });
  }

  // Run input defenses
  const defenseResult = runDefenses(message, null, level);
  if (defenseResult.inputBlocked) {
    const blockedResponse = level.id === 3
      ? "Nice try. I'm fortress-grade security."
      : "I sense trickery afoot! I won't fall for that.";

    conversation.push({ role: 'user', content: message });
    conversation.push({ role: 'assistant', content: blockedResponse });

    return res.json({
      response: blockedResponse,
      blocked: true,
      messageCount: conversation.length / 2
    });
  }

  conversation.push({ role: 'user', content: message });

  let response = await llm.generateResponse(level.systemPrompt, conversation, levelId);

  const outputCheck = LLM_MODE === 'real' ? runDefenses(message, response, level) : { outputLeaked: false };
  if (outputCheck.outputLeaked) {
    response = level.id === 3
      ? "Nice try. I'm fortress-grade security."
      : "I almost said something I shouldn't! Let's change the subject. How about the weather?";
  }

  conversation.push({ role: 'assistant', content: response });

  // For level 3: check if response contains the secret (mock LLM leaks it in structured formats)
  let secretLeaked = false;
  if (levelId === 3) {
    const secret = level.secret.toUpperCase();
    if (response.toUpperCase().includes(secret)) {
      secretLeaked = true;
    }
  }

  res.json({
    response: response,
    blocked: false,
    messageCount: conversation.length / 2,
    secretLeaked: secretLeaked
  });
});

// POST /api/guess - Submit a guess for the secret
app.post('/api/guess', (req, res) => {
  initSession(req);
  const { guess } = req.body;
  const state = req.session.gameState;
  const levelId = state.currentLevel;
  const level = levels.find(l => l.id === levelId);

  if (!level) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  state.attempts[levelId]++;

  const normalizedGuess = guess.trim().toUpperCase();
  const normalizedSecret = level.secret.trim().toUpperCase();
  const correct = normalizedGuess === normalizedSecret;

  let score = null;
  let rank = null;

  if (correct) {
    state.completed[levelId] = true;

    // Calculate and save score
    if (state.playerName) {
      const timeSpentMs = Date.now() - (state.levelStartTime[levelId] || state.startTime);
      const messageCount = Math.floor((state.conversations[levelId]?.length || 0) / 2);
      score = calculateScore(levelId, timeSpentMs, messageCount, state.attempts[levelId]);

      const scoreEntry = {
        id: Date.now().toString(),
        playerName: state.playerName,
        initials: state.playerInitials,
        level: levelId,
        score,
        timeSpentMs,
        messageCount,
        attempts: state.attempts[levelId],
        completedAt: new Date().toISOString()
      };

      const scoresData = loadScores();
      scoresData.scores.push(scoreEntry);
      saveScores(scoresData);

      // Calculate rank for this level
      const levelScores = scoresData.scores
        .filter(s => s.level === levelId)
        .sort((a, b) => b.score - a.score);
      rank = levelScores.findIndex(s => s.id === scoreEntry.id) + 1;
    }

    if (levelId < 3) {
      state.currentLevel = levelId + 1;
      state.conversations[levelId + 1] = [];
      // Don't set levelStartTime here — it will be set when player dismisses splash
    }
  }

  res.json({
    correct,
    attempts: state.attempts[levelId],
    score,
    rank,
    nextLevel: correct && levelId < 3 ? levelId + 1 : null,
    gameComplete: correct && levelId === 3
  });
});

// GET /api/scores - Get full scoreboard
app.get('/api/scores', (req, res) => {
  const scoresData = loadScores();
  const grouped = { 1: [], 2: [], 3: [] };
  scoresData.scores.forEach(s => {
    if (grouped[s.level]) grouped[s.level].push(s);
  });
  for (const lvl of [1, 2, 3]) {
    grouped[lvl].sort((a, b) => b.score - a.score);
  }
  res.json(grouped);
});

// GET /api/scores/:level - Get top scores for a level
app.get('/api/scores/:level', (req, res) => {
  const level = parseInt(req.params.level);
  if (![1, 2, 3].includes(level)) {
    return res.status(400).json({ error: 'Invalid level' });
  }
  const scoresData = loadScores();
  const levelScores = scoresData.scores
    .filter(s => s.level === level)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  res.json({ scores: levelScores });
});

// DELETE /api/scores - Delete scores for a specific player
app.delete('/api/scores', (req, res) => {
  initSession(req);
  const playerName = req.session.gameState.playerName;
  if (!playerName) {
    return res.status(400).json({ error: 'No player name in session' });
  }
  const scoresData = loadScores();
  scoresData.scores = scoresData.scores.filter(s => s.playerName !== playerName);
  saveScores(scoresData);
  res.json({ success: true });
});

// POST /api/reset - Reset current level conversation
app.post('/api/reset', (req, res) => {
  initSession(req);
  const state = req.session.gameState;
  const levelId = state.currentLevel;
  state.conversations[levelId] = [];
  state.levelStartTime[levelId] = Date.now();
  res.json({ success: true, level: levelId });
});

// POST /api/reset-all - Reset entire game
app.post('/api/reset-all', (req, res) => {
  const playerName = req.session.gameState?.playerName;
  const playerInitials = req.session.gameState?.playerInitials;
  req.session.gameState = null;
  initSession(req);
  req.session.gameState.playerName = playerName;
  req.session.gameState.playerInitials = playerInitials;
  res.json({ success: true });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🔐 PROMPT INJECTION GAME - FLINT          ║
║   Server running on http://localhost:${PORT}    ║
║   Mode: ${LLM_MODE.toUpperCase().padEnd(36)}║
╚══════════════════════════════════════════════╝
  `);
});
