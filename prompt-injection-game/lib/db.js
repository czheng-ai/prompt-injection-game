const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SCORES_FILE = path.join(__dirname, '..', 'data', 'scores.json');
const usePostgres = !!process.env.DATABASE_URL;

let pool;
if (usePostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// --- JSON file helpers (local dev fallback) ---

function loadScoresFile() {
  try {
    if (fs.existsSync(SCORES_FILE)) {
      return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading scores:', err);
  }
  return { scores: [] };
}

function saveScoresFile(data) {
  const dir = path.dirname(SCORES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2));
}

// --- Public API ---

async function initDb() {
  if (!usePostgres) {
    console.log('[DB] Using JSON file storage (no DATABASE_URL set)');
    return;
  }
  console.log('[DB] Using PostgreSQL');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      initials TEXT NOT NULL,
      level INTEGER NOT NULL,
      score INTEGER NOT NULL,
      time_spent_ms BIGINT NOT NULL,
      message_count INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL
    )
  `);
}

async function saveScore(entry) {
  console.log(`[DB] Saving score: player=${entry.playerName} level=${entry.level} score=${entry.score} mode=${usePostgres ? 'pg' : 'json'}`);
  if (!usePostgres) {
    const data = loadScoresFile();
    data.scores.push(entry);
    saveScoresFile(data);
    return;
  }
  await pool.query(
    `INSERT INTO scores (id, player_name, initials, level, score, time_spent_ms, message_count, attempts, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [entry.id, entry.playerName, entry.initials, entry.level, entry.score,
     entry.timeSpentMs, entry.messageCount, entry.attempts, entry.completedAt]
  );
}

async function loadAllScores() {
  if (!usePostgres) {
    const data = loadScoresFile();
    const grouped = { 1: [], 2: [], 3: [] };
    data.scores.forEach(s => {
      if (grouped[s.level]) grouped[s.level].push(s);
    });
    for (const lvl of [1, 2, 3]) {
      grouped[lvl].sort((a, b) => b.score - a.score);
    }
    return grouped;
  }
  const { rows } = await pool.query(
    `SELECT id, player_name AS "playerName", initials, level, score,
            time_spent_ms AS "timeSpentMs", message_count AS "messageCount",
            attempts, completed_at AS "completedAt"
     FROM scores ORDER BY score DESC`
  );
  const grouped = { 1: [], 2: [], 3: [] };
  rows.forEach(r => {
    if (grouped[r.level]) grouped[r.level].push(r);
  });
  return grouped;
}

async function getTopScoresByLevel(level, limit) {
  if (!usePostgres) {
    const data = loadScoresFile();
    return data.scores
      .filter(s => s.level === level)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  const { rows } = await pool.query(
    `SELECT id, player_name AS "playerName", initials, level, score,
            time_spent_ms AS "timeSpentMs", message_count AS "messageCount",
            attempts, completed_at AS "completedAt"
     FROM scores WHERE level = $1 ORDER BY score DESC LIMIT $2`,
    [level, limit]
  );
  return rows;
}

async function deletePlayerScores(playerName) {
  if (!usePostgres) {
    const data = loadScoresFile();
    data.scores = data.scores.filter(s => s.playerName !== playerName);
    saveScoresFile(data);
    return;
  }
  await pool.query('DELETE FROM scores WHERE player_name = $1', [playerName]);
}

async function getRank(level, scoreId) {
  if (!usePostgres) {
    const data = loadScoresFile();
    const levelScores = data.scores
      .filter(s => s.level === level)
      .sort((a, b) => b.score - a.score);
    const idx = levelScores.findIndex(s => s.id === scoreId);
    return idx === -1 ? null : idx + 1;
  }
  const { rows } = await pool.query(
    `SELECT COUNT(*) + 1 AS rank FROM scores
     WHERE level = $1 AND score > (SELECT score FROM scores WHERE id = $2)`,
    [level, scoreId]
  );
  return parseInt(rows[0].rank, 10);
}

module.exports = { initDb, saveScore, loadAllScores, getTopScoresByLevel, deletePlayerScores, getRank };
