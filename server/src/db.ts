import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'calc.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      material_price REAL NOT NULL DEFAULT 0,
      labor_price REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS template_stages (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_items (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL REFERENCES template_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      material_price REAL NOT NULL DEFAULT 0,
      labor_price REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      catalog_item_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      access_key TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      extra_materials REAL NOT NULL DEFAULT 0,
      extra_labor REAL NOT NULL DEFAULT 0,
      extra_note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      material_price REAL NOT NULL DEFAULT 0,
      labor_price REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      catalog_item_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  migrateColumns();
}

function migrateColumns() {
  const stageCols = db.prepare('PRAGMA table_info(stages)').all() as Array<{ name: string }>;
  const names = new Set(stageCols.map((c) => c.name));
  if (!names.has('extra_materials')) {
    db.exec('ALTER TABLE stages ADD COLUMN extra_materials REAL NOT NULL DEFAULT 0');
  }
  if (!names.has('extra_labor')) {
    db.exec('ALTER TABLE stages ADD COLUMN extra_labor REAL NOT NULL DEFAULT 0');
  }
  if (!names.has('extra_note')) {
    db.exec("ALTER TABLE stages ADD COLUMN extra_note TEXT DEFAULT ''");
  }
}
