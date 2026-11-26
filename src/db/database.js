const bcrypt = require('bcrypt');

const databaseUrl = process.env.DATABASE_URL || '';
const usePostgres = Boolean(databaseUrl);

let sqlite;
let pool;

function toPostgres(sql) {
  let index = 0;
  return sql
    .replace(/collate\s+nocase/gi, '')
    .replace(
      /datetime\('now'\)/gi,
      "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')"
    )
    .replace(/\?/g, () => `$${++index}`);
}

function postgresSsl(url) {
  if (/sslmode=require/i.test(url) || /\.render\.com/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function createPostgresDb() {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: postgresSsl(databaseUrl),
    max: 5
  });

  return {
    prepare(sql) {
      const text = toPostgres(sql);
      return {
        async get(...params) {
          const result = await pool.query(text, params);
          return result.rows[0];
        },
        async all(...params) {
          const result = await pool.query(text, params);
          return result.rows;
        },
        async run(...params) {
          let query = text;
          if (/^\s*insert\b/i.test(query) && !/\breturning\b/i.test(query)) {
            query = query.replace(/;?\s*$/, '') + ' RETURNING *';
          }
          const result = await pool.query(query, params);
          const row = result.rows[0];
          return {
            lastInsertRowid: row ? row.id : undefined,
            changes: result.rowCount
          };
        }
      };
    }
  };
}

function createSqliteDb() {
  const Database = require('better-sqlite3');
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  sqlite = new Database(path.join(dataDir, 'travel.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        get: (...params) => Promise.resolve(stmt.get(...params)),
        all: (...params) => Promise.resolve(stmt.all(...params)),
        run: (...params) => Promise.resolve(stmt.run(...params))
      };
    },
    exec(sql) {
      sqlite.exec(sql);
    }
  };
}

const db = usePostgres ? createPostgresDb() : createSqliteDb();

const SCHEMA = `
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
    region TEXT NOT NULL DEFAULT '',
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
`;

function postgresSchema() {
  return SCHEMA
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY')
    .replace(/COLLATE NOCASE/g, '')
    .replace(
      /datetime\('now'\)/g,
      "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')"
    );
}

async function initSchema() {
  if (!usePostgres) {
    db.exec(SCHEMA);
    const columns = sqlite.prepare('PRAGMA table_info(profiles)').all();
    if (!columns.some((column) => column.name === 'region')) {
      sqlite.exec("ALTER TABLE profiles ADD COLUMN region TEXT NOT NULL DEFAULT ''");
    }
    return;
  }

  const statements = postgresSchema()
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'`
  );
  if (!columns.rows.some((column) => column.column_name === 'region')) {
    await pool.query("ALTER TABLE profiles ADD COLUMN region TEXT NOT NULL DEFAULT ''");
  }
}

async function seedUsers() {
  const count = await db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (Number(count.c) > 0) return;

  const insert = db.prepare(
    'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const profile = db.prepare(
    'INSERT INTO profiles (user_id, destinations, travel_start, travel_end, travel_styles, bio, region) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const adminHash = bcrypt.hashSync('Admin123!', 10);
  const demoHash = bcrypt.hashSync('Demo123!', 10);
  const travelerHash = bcrypt.hashSync('Travel123!', 10);

  const admin = await insert.run('admin@travel.local', 'admin', adminHash, 'admin');
  const demo = await insert.run('demo@travel.local', 'demo', demoHash, 'user');
  const maya = await insert.run('maya@travel.local', 'maya', travelerHash, 'user');
  const ken = await insert.run('ken@travel.local', 'ken', travelerHash, 'user');

  await profile.run(admin.lastInsertRowid, 'Tokyo, Kyoto', '2026-11-01', '2026-11-10', 'culture,food', 'Platform admin & traveler.', 'mainland');
  await profile.run(demo.lastInsertRowid, 'Tokyo, Osaka, Bali', '2026-11-05', '2026-11-15', 'adventure,food,photography', 'Looking for a Tokyo adventure buddy.', 'europe');
  await profile.run(maya.lastInsertRowid, 'Tokyo, Seoul', '2026-11-03', '2026-11-12', 'culture,food,shopping', 'Foodie exploring East Asia.', 'europe');
  await profile.run(ken.lastInsertRowid, 'Bali, Bangkok', '2026-12-01', '2026-12-14', 'beach,adventure,budget', 'Island hopping this winter.', 'mainland');

  const post = db.prepare(
    `INSERT INTO posts (user_id, title, destination, start_date, end_date, content, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  await post.run(
    demo.lastInsertRowid,
    'Hidden ramen alleys in Tokyo',
    'Tokyo',
    '2025-09-10',
    '2025-09-18',
    'Spent a week hunting late-night ramen spots in Shinjuku and Shibuya. Tip: arrive before 10pm or join the queue — worth every minute.',
    'food,tokyo,ramen'
  );
  await post.run(
    maya.lastInsertRowid,
    'Cherry blossoms & temples in Kyoto',
    'Kyoto',
    '2025-04-01',
    '2025-04-07',
    'Best light for photos is early morning at Fushimi Inari. Book tea ceremonies ahead in peak season.',
    'culture,kyoto,photography'
  );
}

async function backfillDemoRegions() {
  const assignments = [
    ['europe', 'demo'],
    ['europe', 'maya'],
    ['mainland', 'ken'],
    ['mainland', 'admin']
  ];
  const update = db.prepare(
    `UPDATE profiles
     SET region = ?
     WHERE region = ''
       AND user_id = (SELECT id FROM users WHERE lower(username) = lower(?))`
  );
  for (const [region, username] of assignments) {
    await update.run(region, username);
  }
}

async function init() {
  await initSchema();
  await seedUsers();
  await backfillDemoRegions();
  return { pool };
}

function getPool() {
  return pool;
}

module.exports = { db, init, usePostgres, getPool };
