const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'travel.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      destinations TEXT NOT NULL DEFAULT '',
      travel_start TEXT,
      travel_end TEXT,
      travel_styles TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (trip_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS trip_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL DEFAULT 1,
      place TEXT NOT NULL,
      time TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const profile = db.prepare(
    'INSERT INTO profiles (user_id, destinations, travel_start, travel_end, travel_styles, bio) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const adminHash = bcrypt.hashSync('Admin123!', 10);
  const demoHash = bcrypt.hashSync('Demo123!', 10);
  const travelerHash = bcrypt.hashSync('Travel123!', 10);

  const admin = insert.run('admin@travel.local', 'admin', adminHash, 'admin');
  const demo = insert.run('demo@travel.local', 'demo', demoHash, 'user');
  const t1 = insert.run('maya@travel.local', 'maya', travelerHash, 'user');
  const t2 = insert.run('ken@travel.local', 'ken', travelerHash, 'user');

  profile.run(admin.lastInsertRowid, 'Tokyo, Kyoto', '2026-11-01', '2026-11-10', 'culture,food', 'Platform admin & traveler.');
  profile.run(demo.lastInsertRowid, 'Tokyo, Osaka, Bali', '2026-11-05', '2026-11-15', 'adventure,food,photography', 'Looking for a Tokyo adventure buddy.');
  profile.run(t1.lastInsertRowid, 'Tokyo, Seoul', '2026-11-03', '2026-11-12', 'culture,food,shopping', 'Foodie exploring East Asia.');
  profile.run(t2.lastInsertRowid, 'Bali, Bangkok', '2026-12-01', '2026-12-14', 'beach,adventure,budget', 'Island hopping this winter.');

  const post = db.prepare(
    `INSERT INTO posts (user_id, title, destination, start_date, end_date, content, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  post.run(
    demo.lastInsertRowid,
    'Hidden ramen alleys in Tokyo',
    'Tokyo',
    '2025-09-10',
    '2025-09-18',
    'Spent a week hunting late-night ramen spots in Shinjuku and Shibuya. Tip: arrive before 10pm or join the queue — worth every minute.',
    'food,tokyo,ramen'
  );
  post.run(
    t1.lastInsertRowid,
    'Cherry blossoms & temples in Kyoto',
    'Kyoto',
    '2025-04-01',
    '2025-04-07',
    'Best light for photos is early morning at Fushimi Inari. Book tea ceremonies ahead in peak season.',
    'culture,kyoto,photography'
  );
}

function init() {
  initSchema();
  seedUsers();
}

module.exports = { db, init };
