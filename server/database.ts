import Database, { Database as DatabaseType, Statement } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database path from environment variable or use default
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'journal.db');

// Ensure database directory exists
import { mkdirSync } from 'fs';
const dbDir = path.dirname(dbPath);
try {
  mkdirSync(dbDir, { recursive: true });
} catch (err) {
  // Directory might already exist, ignore error
}

console.log(`Database path: ${dbPath}`);
export const db: DatabaseType = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create diary_entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    )
  `);

  // Create index for faster session lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)
  `);

  console.log('Database initialized successfully');
}

// Initialize database immediately
initializeDatabase();

// User queries (created after tables exist)
export const userQueries: {
  findByUsername: Statement;
  findById: Statement;
  create: Statement;
  updatePassword: Statement;
} = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  create: db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
};

// Diary entry queries
export const entryQueries: {
  findByUserId: Statement;
  findByUserIdAndDate: Statement;
  create: Statement;
  update: Statement;
  delete: Statement;
  findById: Statement;
} = {
  findByUserId: db.prepare('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY date DESC'),
  findByUserIdAndDate: db.prepare('SELECT * FROM diary_entries WHERE user_id = ? AND date = ?'),
  create: db.prepare('INSERT INTO diary_entries (id, user_id, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE diary_entries SET content = ?, updated_at = ? WHERE user_id = ? AND date = ?'),
  delete: db.prepare('DELETE FROM diary_entries WHERE id = ?'),
  findById: db.prepare('SELECT * FROM diary_entries WHERE id = ?'),
};

// Session queries for express-session store
export const sessionQueries: {
  get: Statement;
  set: Statement;
  destroy: Statement;
  clear: Statement;
  length: Statement;
  touch: Statement;
} = {
  get: db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire >= ?'),
  set: db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)'),
  destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
  clear: db.prepare('DELETE FROM sessions'),
  length: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expire >= ?'),
  touch: db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?'),
};

