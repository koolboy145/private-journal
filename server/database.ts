import Database, { Database as DatabaseType, Statement } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database path from environment variable or use default
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'journal.db');

// Ensure database directory exists
import { mkdirSync, accessSync, constants } from 'fs';

const dbDir = path.dirname(dbPath);

// Create directory if it doesn't exist
try {
  mkdirSync(dbDir, { recursive: true });
  console.log(`✅ Database directory ready: ${dbDir}`);
} catch (err: any) {
  if (err.code === 'EEXIST') {
    // Directory already exists, that's fine
    console.log(`✅ Database directory exists: ${dbDir}`);
  } else if (err.code === 'EACCES' || err.code === 'EPERM') {
    console.error(`❌ ERROR: Permission denied creating directory: ${dbDir}`);
    console.error(`   Run: sudo chown -R 1001:1001 ${dbDir}`);
    process.exit(1);
  } else {
    console.error(`⚠️  Warning: Could not create directory ${dbDir}:`, err.message);
    console.log(`   Attempting to continue anyway...`);
  }
}

// Check write permissions
try {
  accessSync(dbDir, constants.W_OK);
  console.log(`✅ Database directory is writable`);
} catch (err: any) {
  console.error(`❌ ERROR: Database directory is not writable: ${dbDir}`);
  console.error(`   Current user: ${process.getuid?.() || 'unknown'}`);
  console.error(`   Fix permissions: sudo chown -R 1001:1001 ${dbDir}`);
  process.exit(1);
}

console.log(`📊 Database path: ${dbPath}`);

// Initialize database connection
let db: DatabaseType;
try {
  db = new Database(dbPath);
  console.log(`✅ Database connection established`);
} catch (err: any) {
  console.error(`❌ FATAL ERROR: Could not open database: ${dbPath}`);
  console.error(`   Error: ${err.message}`);
  console.error(`   This usually indicates a permission or disk space issue.`);
  process.exit(1);
}

export { db };

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
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add profile fields to existing databases (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN first_name TEXT`);
    console.log('✅ Added first_name column to users table');
  } catch (err: any) {
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
      console.log('✅ first_name column already exists in users table');
    } else {
      console.warn('⚠️  Could not add first_name column (may already exist):', err.message);
    }
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_name TEXT`);
    console.log('✅ Added last_name column to users table');
  } catch (err: any) {
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
      console.log('✅ last_name column already exists in users table');
    } else {
      console.warn('⚠️  Could not add last_name column (may already exist):', err.message);
    }
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    console.log('✅ Added email column to users table');
  } catch (err: any) {
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
      console.log('✅ email column already exists in users table');
    } else {
      console.warn('⚠️  Could not add email column (may already exist):', err.message);
    }
  }

  // Create diary_entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      mood TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add mood column if it doesn't exist (migration for existing databases)
  try {
    db.exec(`ALTER TABLE diary_entries ADD COLUMN mood TEXT`);
    console.log('✅ Added mood column to diary_entries table');
  } catch (err: any) {
    // Column already exists, which is fine (SQLite throws error if column exists)
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
      console.log('✅ Mood column already exists in diary_entries table');
    } else {
      // Unexpected error, log it but don't crash
      console.warn('⚠️  Could not add mood column (may already exist):', err.message);
    }
  }

  // Remove UNIQUE constraint on (user_id, date) to allow multiple entries per day
  // SQLite doesn't support dropping UNIQUE constraints directly, so we need to recreate the table
  try {
    // Check if unique constraint exists by querying sqlite_master for the table definition
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='diary_entries'").get() as any;
    const hasUniqueConstraint = tableInfo && tableInfo.sql && tableInfo.sql.includes('UNIQUE(user_id, date)');

    // Also check for auto-created unique indexes (SQLite creates these for UNIQUE constraints)
    const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='diary_entries'").all() as any[];
    const hasUniqueIndex = indexes.some(idx =>
      idx.name && (
        idx.name.includes('autoindex') ||
        (idx.sql && idx.sql.includes('UNIQUE') && (idx.sql.includes('user_id') || idx.sql.includes('date')))
      )
    );

    // Also try to detect the constraint by attempting to query all indexes including auto-created ones
    const allIndexes = db.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type='index' AND tbl_name='diary_entries'
    `).all() as any[];
    const hasAutoIndex = allIndexes.length > 0 && allIndexes.some(idx => idx.name?.startsWith('sqlite_autoindex'));

    if (hasUniqueConstraint || hasUniqueIndex || hasAutoIndex) {
      console.log('⚠️  Found UNIQUE constraint/index on diary_entries, migrating table...');

      // Clean up any leftover new table from previous failed migration
      try {
        db.exec(`DROP TABLE IF EXISTS diary_entries_new`);
      } catch (cleanupErr: any) {
        // Ignore cleanup errors
      }

      // Use a transaction to ensure atomicity
      db.exec('BEGIN TRANSACTION');

      try {
        // Create new table without UNIQUE constraint
        db.exec(`
          CREATE TABLE diary_entries_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            date TEXT NOT NULL,
            content TEXT NOT NULL,
            mood TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        // Get the current timestamp to use as fallback
        const now = new Date().toISOString();

        // Copy all data from old table to new table
        // Explicitly handle each column and ensure NOT NULL fields have values
        const copyStmt = db.prepare(`
          INSERT INTO diary_entries_new (id, user_id, date, content, mood, created_at, updated_at)
          SELECT
            id,
            user_id,
            date,
            content,
            mood,
            COALESCE(NULLIF(created_at, ''), ?) as created_at,
            COALESCE(NULLIF(updated_at, ''), ?) as updated_at
          FROM diary_entries
        `);
        copyStmt.run(now, now);

        // Drop old table (this will also drop all associated indexes)
        db.exec(`DROP TABLE diary_entries`);

        // Rename new table to original name
        db.exec(`ALTER TABLE diary_entries_new RENAME TO diary_entries`);

        // Recreate indexes that don't have UNIQUE constraint
        // The entry_tags foreign key should still work since we kept the id column
        db.exec('COMMIT');

        console.log('✅ Successfully migrated diary_entries table to remove UNIQUE constraint');
      } catch (migrationErr: any) {
        db.exec('ROLLBACK');
        // Clean up any leftover table
        try {
          db.exec(`DROP TABLE IF EXISTS diary_entries_new`);
        } catch (cleanupErr: any) {
          // Ignore cleanup errors
        }
        throw migrationErr;
      }
    } else {
      console.log('✅ No UNIQUE constraint found on diary_entries table');
    }
  } catch (err: any) {
    // If migration fails, log warning but don't crash
    console.warn('⚠️  Could not remove UNIQUE constraint from diary_entries table:', err.message);
    console.warn('⚠️  You may need to manually remove the constraint or recreate the table');
    // Clean up any leftover table
    try {
      db.exec(`DROP TABLE IF EXISTS diary_entries_new`);
    } catch (cleanupErr: any) {
      // Ignore cleanup errors
    }
  }

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

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // Create entry_tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag_id),
      FOREIGN KEY (entry_id) REFERENCES diary_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for tag queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id)
  `);

  // Create reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      time TEXT NOT NULL,
      days_of_week TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      email_address TEXT,
      webhook_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for reminder queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(is_enabled)
  `);

  // Add body column if it doesn't exist (migration for existing databases)
  try {
    db.exec(`ALTER TABLE reminders ADD COLUMN body TEXT`);
    console.log('✅ Added body column to reminders table');
  } catch (err: any) {
    const errMsg = err.message?.toLowerCase() || '';
    if (errMsg.includes('duplicate') || errMsg.includes('already exists')) {
      console.log('✅ Body column already exists in reminders table');
    } else {
      console.warn('⚠️  Could not add body column (may already exist):', err.message);
    }
  }

  // Create templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for template queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)
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
  updateProfile: Statement;
} = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  create: db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  updateProfile: db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?'),
};

// Diary entry queries
export const entryQueries: {
  findByUserId: Statement;
  findByUserIdAndDate: Statement;
  findAllByUserIdAndDate: Statement;
  create: Statement;
  update: Statement;
  updateById: Statement;
  delete: Statement;
  findById: Statement;
} = {
  findByUserId: db.prepare('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY date DESC'),
  findByUserIdAndDate: db.prepare('SELECT * FROM diary_entries WHERE user_id = ? AND date = ? LIMIT 1'),
  findAllByUserIdAndDate: db.prepare('SELECT * FROM diary_entries WHERE user_id = ? AND date = ? ORDER BY created_at DESC'),
  create: db.prepare('INSERT INTO diary_entries (id, user_id, date, content, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE diary_entries SET content = ?, mood = ?, updated_at = ? WHERE user_id = ? AND date = ?'),
  updateById: db.prepare('UPDATE diary_entries SET content = ?, mood = ?, updated_at = ? WHERE id = ?'),
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

// Tag queries
export const tagQueries: {
  findByUserId: Statement;
  findById: Statement;
  findByUserIdAndName: Statement;
  create: Statement;
  update: Statement;
  delete: Statement;
  findByEntryId: Statement;
  createEntryTag: Statement;
  deleteEntryTag: Statement;
  deleteAllEntryTags: Statement;
} = {
  findByUserId: db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY LOWER(name) ASC'),
  findById: db.prepare('SELECT * FROM tags WHERE id = ?'),
  findByUserIdAndName: db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?'),
  create: db.prepare('INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?'),
  delete: db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?'),
  findByEntryId: db.prepare('SELECT t.* FROM tags t INNER JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?'),
  createEntryTag: db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)'),
  deleteEntryTag: db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?'),
  deleteAllEntryTags: db.prepare('DELETE FROM entry_tags WHERE entry_id = ?'),
};

// Reminder queries
export const reminderQueries: {
  findByUserId: Statement;
  findById: Statement;
  create: Statement;
  update: Statement;
  delete: Statement;
  findEnabled: Statement;
} = {
  findByUserId: db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC'),
  findById: db.prepare('SELECT * FROM reminders WHERE id = ?'),
  create: db.prepare('INSERT INTO reminders (id, user_id, title, body, time, days_of_week, notification_type, email_address, webhook_url, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE reminders SET title = ?, body = ?, time = ?, days_of_week = ?, notification_type = ?, email_address = ?, webhook_url = ?, is_enabled = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
  delete: db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?'),
  findEnabled: db.prepare('SELECT * FROM reminders WHERE is_enabled = 1'),
};

// Template queries
export const templateQueries: {
  findByUserId: Statement;
  findById: Statement;
  create: Statement;
  update: Statement;
  delete: Statement;
} = {
  findByUserId: db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC'),
  findById: db.prepare('SELECT * FROM templates WHERE id = ?'),
  create: db.prepare('INSERT INTO templates (id, user_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE templates SET name = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
  delete: db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?'),
};
