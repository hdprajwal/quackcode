import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'quackcode.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      last_opened_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Thread',
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'anthropic',
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error')),
      archived_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      latest_turn_id TEXT,
      has_pending_approval INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
      content TEXT NOT NULL DEFAULT '',
      tool_calls TEXT,
      tool_results TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_events (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      turn_id TEXT,
      sequence INTEGER NOT NULL,
      kind TEXT NOT NULL,
      tone TEXT NOT NULL CHECK (tone IN ('info', 'tool', 'approval', 'error')),
      summary TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_threads_project_id ON threads(project_id);
    CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_threads_archived_at ON threads(archived_at);
    CREATE INDEX IF NOT EXISTS idx_threads_sort_order ON threads(project_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_thread_events_thread_id ON thread_events(thread_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_thread_events_turn_id ON thread_events(turn_id);

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_ids TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'anthropic',
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      schedule_type TEXT NOT NULL DEFAULT 'interval' CHECK (schedule_type IN ('daily', 'interval')),
      interval_value INTEGER NOT NULL DEFAULT 60,
      interval_unit TEXT NOT NULL DEFAULT 'minutes' CHECK (interval_unit IN ('minutes', 'hours', 'days')),
      scheduled_time TEXT,
      scheduled_days TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automation_executions (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );
  `)

  migrateThreadsTable(db)
  migrateAutomationsTable(db)
  ensureAutomationIndexes(db)
}

function getTableColumns(db: Database.Database, tableName: string): Set<string> {
  return new Set(
    (
      db.prepare(`PRAGMA table_info('${tableName}')`).all() as Array<{
        name: string
      }>
    ).map((column) => column.name)
  )
}

function migrateThreadsTable(db: Database.Database): void {
  const columns = getTableColumns(db, 'threads')

  const additions: Array<[string, string]> = [
    ['status', "TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error'))"],
    ['archived_at', 'TEXT'],
    ['sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['last_activity_at', "TEXT NOT NULL DEFAULT (datetime('now'))"],
    ['latest_turn_id', 'TEXT'],
    ['has_pending_approval', 'INTEGER NOT NULL DEFAULT 0']
  ]

  for (const [name, ddl] of additions) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE threads ADD COLUMN ${name} ${ddl}`)
    }
  }

  // Seed sort_order from updated_at ordering so existing threads retain a stable order.
  const needsSeed = db
    .prepare("SELECT COUNT(*) as n FROM threads WHERE sort_order = 0")
    .get() as { n: number }
  if (needsSeed.n > 0) {
    const seed = db.transaction(() => {
      const rows = db
        .prepare('SELECT id, project_id, updated_at FROM threads ORDER BY project_id, updated_at DESC')
        .all() as Array<{ id: string; project_id: string; updated_at: string }>
      let currentProject = ''
      let cursor = 0
      const update = db.prepare('UPDATE threads SET sort_order = ? WHERE id = ?')
      for (const row of rows) {
        if (row.project_id !== currentProject) {
          currentProject = row.project_id
          cursor = 0
        }
        cursor += 1
        update.run(cursor, row.id)
      }
    })
    seed()
  }

  // Seed last_activity_at from updated_at if empty.
  db.exec(
    "UPDATE threads SET last_activity_at = updated_at WHERE last_activity_at IS NULL OR last_activity_at = ''"
  )
}

function migrateAutomationsTable(db: Database.Database): void {
  const columns = getTableColumns(db, 'automations')

  if (columns.has('project_id')) {
    rebuildAutomationsTable(db, columns)
    return
  }

  if (!columns.has('project_ids')) {
    db.exec("ALTER TABLE automations ADD COLUMN project_ids TEXT NOT NULL DEFAULT ''")
    columns.add('project_ids')
  }

  if (!columns.has('schedule_type')) {
    db.exec(
      "ALTER TABLE automations ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'interval' CHECK (schedule_type IN ('daily', 'interval'))"
    )
    columns.add('schedule_type')
  }

  if (!columns.has('scheduled_time')) {
    db.exec('ALTER TABLE automations ADD COLUMN scheduled_time TEXT')
    columns.add('scheduled_time')
  }

  if (!columns.has('scheduled_days')) {
    db.exec('ALTER TABLE automations ADD COLUMN scheduled_days TEXT')
  }
}

function rebuildAutomationsTable(db: Database.Database, columns: Set<string>): void {
  const projectIdsExpr = columns.has('project_ids')
    ? "CASE WHEN project_ids IS NOT NULL AND project_ids != '' THEN project_ids ELSE COALESCE(project_id, '') END"
    : "COALESCE(project_id, '')"

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE automations_migrated (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_ids TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'anthropic',
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
        schedule_type TEXT NOT NULL DEFAULT 'interval' CHECK (schedule_type IN ('daily', 'interval')),
        interval_value INTEGER NOT NULL DEFAULT 60,
        interval_unit TEXT NOT NULL DEFAULT 'minutes' CHECK (interval_unit IN ('minutes', 'hours', 'days')),
        scheduled_time TEXT,
        scheduled_days TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
        last_run_at TEXT,
        next_run_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)

    db.exec(`
      INSERT INTO automations_migrated (
        id,
        name,
        project_ids,
        prompt,
        provider,
        model,
        schedule_type,
        interval_value,
        interval_unit,
        scheduled_time,
        scheduled_days,
        status,
        last_run_at,
        next_run_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        name,
        ${projectIdsExpr},
        prompt,
        provider,
        model,
        ${columns.has('schedule_type') ? "COALESCE(schedule_type, 'interval')" : "'interval'"},
        ${columns.has('interval_value') ? 'COALESCE(interval_value, 60)' : '60'},
        ${columns.has('interval_unit') ? "COALESCE(interval_unit, 'minutes')" : "'minutes'"},
        ${columns.has('scheduled_time') ? 'scheduled_time' : 'NULL'},
        ${columns.has('scheduled_days') ? 'scheduled_days' : 'NULL'},
        ${columns.has('status') ? "COALESCE(status, 'active')" : "'active'"},
        ${columns.has('last_run_at') ? 'last_run_at' : 'NULL'},
        ${columns.has('next_run_at') ? 'next_run_at' : 'NULL'},
        ${columns.has('created_at') ? 'created_at' : "datetime('now')"},
        ${columns.has('updated_at') ? 'updated_at' : "datetime('now')"}
      FROM automations;
    `)

    db.exec('DROP TABLE automations')
    db.exec('ALTER TABLE automations_migrated RENAME TO automations')
  })

  db.exec('PRAGMA foreign_keys = OFF')

  try {
    migrate()
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

function ensureAutomationIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
    CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id ON automation_executions(automation_id);
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
