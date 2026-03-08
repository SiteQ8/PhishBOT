// db.js — SQLite database initialization and access
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'phishbot.db');
const db = new Database(DB_PATH);

// Enable WAL for concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS keywords (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    category    TEXT    NOT NULL DEFAULT 'general',
    severity    TEXT    NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    hits        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scan_logs (
    id          TEXT    PRIMARY KEY,
    input       TEXT    NOT NULL,
    input_type  TEXT    NOT NULL DEFAULT 'url',
    verdict     TEXT    NOT NULL CHECK(verdict IN ('clean','suspicious','phishing')),
    score       INTEGER NOT NULL DEFAULT 0,
    signals     TEXT    NOT NULL DEFAULT '[]',
    matched_kw  TEXT    NOT NULL DEFAULT '[]',
    source      TEXT    DEFAULT NULL,
    scanned_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS allowlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    domain      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    added_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at DESC);
  CREATE INDEX IF NOT EXISTS idx_keywords_category    ON keywords(category);
`);

// ── Default keywords seed ─────────────────────────────────────────────────

const defaults = [
  // credential harvesting
  { keyword: 'verify your account',    category: 'credential',  severity: 'high'     },
  { keyword: 'confirm your password',  category: 'credential',  severity: 'high'     },
  { keyword: 'update your banking',    category: 'financial',   severity: 'critical' },
  { keyword: 'click here to unlock',   category: 'urgency',     severity: 'high'     },
  { keyword: 'account suspended',      category: 'urgency',     severity: 'high'     },
  { keyword: 'unusual sign-in',        category: 'credential',  severity: 'medium'   },
  { keyword: 'limited time offer',     category: 'urgency',     severity: 'low'      },
  { keyword: 'you have been selected', category: 'scam',        severity: 'medium'   },
  { keyword: 'congratulations winner', category: 'scam',        severity: 'high'     },
  { keyword: 'wire transfer',          category: 'financial',   severity: 'medium'   },
  { keyword: 'bitcoin wallet',         category: 'financial',   severity: 'medium'   },
  { keyword: 'login credentials',      category: 'credential',  severity: 'high'     },
  { keyword: 'paypal account',         category: 'brand-abuse', severity: 'medium'   },
  { keyword: 'apple id locked',        category: 'brand-abuse', severity: 'high'     },
  { keyword: 'microsoft security',     category: 'brand-abuse', severity: 'medium'   },
  { keyword: 'reset your pin',         category: 'credential',  severity: 'high'     },
  { keyword: 'act immediately',        category: 'urgency',     severity: 'medium'   },
  { keyword: 'verify identity',        category: 'credential',  severity: 'high'     },
];

const insertKw = db.prepare(`
  INSERT OR IGNORE INTO keywords (keyword, category, severity)
  VALUES (@keyword, @category, @severity)
`);
const seedMany = db.transaction((rows) => rows.forEach(r => insertKw.run(r)));
seedMany(defaults);

// ── Default allowlist ─────────────────────────────────────────────────────

const defaultAllowed = [
  'google.com','microsoft.com','apple.com','amazon.com',
  'paypal.com','twitter.com','facebook.com','github.com',
  'linkedin.com','youtube.com',
];
const insertAl = db.prepare('INSERT OR IGNORE INTO allowlist (domain) VALUES (?)');
const seedAl   = db.transaction((d) => d.forEach(v => insertAl.run(v)));
seedAl(defaultAllowed);

module.exports = db;
