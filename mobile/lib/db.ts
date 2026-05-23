import * as SQLite from 'expo-sqlite';

const DB_NAME = 'fittracker.db';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        sex TEXT NOT NULL CHECK(sex IN ('M','F','O')),
        birth_date TEXT NOT NULL,
        height_cm REAL NOT NULL,
        current_weight_kg REAL NOT NULL,
        goal_weight_kg REAL NOT NULL,
        activity_level TEXT NOT NULL CHECK(activity_level IN ('sedentary','light','moderate','active','very_active')),
        daily_water_goal_ml INTEGER NOT NULL DEFAULT 2500,
        daily_calorie_goal INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kcal_per_100g REAL NOT NULL,
        protein_g REAL NOT NULL DEFAULT 0,
        carbs_g REAL NOT NULL DEFAULT 0,
        fat_g REAL NOT NULL DEFAULT 0,
        fiber_g REAL,
        source TEXT NOT NULL DEFAULT 'custom',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_foods_name ON foods(name);

      CREATE TABLE bottles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        capacity_ml INTEGER NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE hydration_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bottle_id INTEGER REFERENCES bottles(id) ON DELETE SET NULL,
        ml INTEGER NOT NULL,
        consumed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_hydration_user_day ON hydration_entries(user_id, consumed_at);

      CREATE TABLE meal_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        meal_type TEXT NOT NULL DEFAULT 'snack' CHECK(meal_type IN ('breakfast','lunch','snack','dinner')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE meal_template_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_template_id INTEGER NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
        food_id INTEGER NOT NULL REFERENCES foods(id),
        quantity_g REAL NOT NULL
      );

      CREATE TABLE meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_template_id INTEGER REFERENCES meal_templates(id) ON DELETE SET NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','snack','dinner')),
        consumed_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT
      );

      CREATE INDEX idx_meals_user_day ON meals(user_id, consumed_at);

      CREATE TABLE meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        food_id INTEGER NOT NULL REFERENCES foods(id),
        quantity_g REAL NOT NULL
      );

      CREATE TABLE weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weight_kg REAL NOT NULL,
        logged_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_weight_user_day ON weight_logs(user_id, logged_at);
    `,
  },
];

async function applyMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM _migrations ORDER BY version'
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const m of MIGRATIONS) {
    if (appliedSet.has(m.version)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync('INSERT INTO _migrations (version) VALUES (?)', m.version);
    });
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await applyMigrations(db);
    _db = db;
    return db;
  })();
  return _initPromise;
}

export async function resetDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  _initPromise = null;
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
