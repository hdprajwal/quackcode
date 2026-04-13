import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import type {
  Thread,
  ThreadStatus,
  Message,
  CreateThreadParams,
  CreateMessageParams,
  ThreadReorderEntry
} from '@shared/types'

interface ThreadRow {
  id: string
  title: string
  project_id: string
  provider: string
  model: string
  status: string
  archived_at: string | null
  sort_order: number
  last_activity_at: string
  latest_turn_id: string | null
  has_pending_approval: number
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  thread_id: string
  role: string
  content: string
  tool_calls: string | null
  tool_results: string | null
  created_at: string
}

export class ThreadService {
  createThread(params: CreateThreadParams): Thread {
    const db = getDatabase()
    const existingEmptyThread = db
      .prepare(
        `SELECT t.*
         FROM threads t
         LEFT JOIN messages m ON m.thread_id = t.id
         WHERE t.project_id = ?
           AND t.provider = ?
           AND t.model = ?
           AND t.archived_at IS NULL
         GROUP BY t.id
         HAVING COUNT(m.id) = 0
         ORDER BY t.updated_at DESC
         LIMIT 1`
      )
      .get(params.projectId, params.provider, params.model) as ThreadRow | undefined

    if (existingEmptyThread) {
      return this.toThread(existingEmptyThread)
    }

    const id = uuidv4()
    const now = new Date().toISOString()
    const title = params.title || 'New Thread'

    const nextOrderRow = db
      .prepare(
        'SELECT COALESCE(MIN(sort_order), 1) - 1 AS next FROM threads WHERE project_id = ? AND archived_at IS NULL'
      )
      .get(params.projectId) as { next: number }

    db.prepare(
      `INSERT INTO threads (
        id, title, project_id, provider, model,
        status, archived_at, sort_order, last_activity_at,
        latest_turn_id, has_pending_approval, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      title,
      params.projectId,
      params.provider,
      params.model,
      'idle',
      null,
      nextOrderRow.next,
      now,
      null,
      0,
      now,
      now
    )

    const row = db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as ThreadRow
    return this.toThread(row)
  }

  listThreads(projectId: string): Thread[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT * FROM threads
         WHERE project_id = ?
         ORDER BY archived_at IS NOT NULL, sort_order ASC, updated_at DESC`
      )
      .all(projectId) as ThreadRow[]
    return rows.map(this.toThread)
  }

  listAllThreads(): Thread[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT * FROM threads
         ORDER BY archived_at IS NOT NULL, project_id, sort_order ASC, updated_at DESC`
      )
      .all() as ThreadRow[]
    return rows.map(this.toThread)
  }

  getThread(threadId: string): Thread | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId) as
      | ThreadRow
      | undefined
    return row ? this.toThread(row) : null
  }

  deleteThread(threadId: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM threads WHERE id = ?').run(threadId)
  }

  deleteThreads(threadIds: string[]): void {
    if (threadIds.length === 0) return
    const db = getDatabase()
    const placeholders = threadIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM threads WHERE id IN (${placeholders})`).run(...threadIds)
  }

  updateTitle(threadId: string, title: string): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare('UPDATE threads SET title = ?, updated_at = ? WHERE id = ?').run(title, now, threadId)
    this.broadcastThreadUpdate(threadId)
  }

  updateStatus(threadId: string, status: ThreadStatus, turnId?: string | null): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    if (turnId !== undefined) {
      db.prepare(
        'UPDATE threads SET status = ?, latest_turn_id = ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
      ).run(status, turnId, now, now, threadId)
    } else {
      db.prepare(
        'UPDATE threads SET status = ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
      ).run(status, now, now, threadId)
    }
    this.broadcastThreadUpdate(threadId)
  }

  setPendingApproval(threadId: string, pending: boolean): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE threads SET has_pending_approval = ?, last_activity_at = ?, updated_at = ? WHERE id = ?'
    ).run(pending ? 1 : 0, now, now, threadId)
    this.broadcastThreadUpdate(threadId)
  }

  bumpActivity(threadId: string): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare('UPDATE threads SET last_activity_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      threadId
    )
    this.broadcastThreadUpdate(threadId)
  }

  archiveThread(threadId: string): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare('UPDATE threads SET archived_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      threadId
    )
    this.broadcastThreadUpdate(threadId)
  }

  archiveThreads(threadIds: string[]): void {
    if (threadIds.length === 0) return
    const db = getDatabase()
    const now = new Date().toISOString()
    const placeholders = threadIds.map(() => '?').join(',')
    db.prepare(
      `UPDATE threads SET archived_at = ?, updated_at = ? WHERE id IN (${placeholders})`
    ).run(now, now, ...threadIds)
    for (const id of threadIds) this.broadcastThreadUpdate(id)
  }

  unarchiveThread(threadId: string): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare('UPDATE threads SET archived_at = NULL, updated_at = ? WHERE id = ?').run(
      now,
      threadId
    )
    this.broadcastThreadUpdate(threadId)
  }

  reorderThreads(entries: ThreadReorderEntry[]): void {
    if (entries.length === 0) return
    const db = getDatabase()
    const stmt = db.prepare('UPDATE threads SET sort_order = ? WHERE id = ?')
    const tx = db.transaction((list: ThreadReorderEntry[]) => {
      for (const entry of list) {
        stmt.run(entry.sortOrder, entry.threadId)
      }
    })
    tx(entries)
    for (const entry of entries) this.broadcastThreadUpdate(entry.threadId)
  }

  createMessage(params: CreateMessageParams): Message {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      'INSERT INTO messages (id, thread_id, role, content, tool_calls, tool_results, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      params.threadId,
      params.role,
      params.content,
      params.toolCalls ? JSON.stringify(params.toolCalls) : null,
      params.toolResults ? JSON.stringify(params.toolResults) : null,
      now
    )

    db.prepare(
      'UPDATE threads SET updated_at = ?, last_activity_at = ? WHERE id = ?'
    ).run(now, now, params.threadId)
    this.broadcastThreadUpdate(params.threadId)

    return {
      id,
      threadId: params.threadId,
      role: params.role,
      content: params.content,
      toolCalls: params.toolCalls,
      toolResults: params.toolResults,
      createdAt: now
    }
  }

  getMessages(threadId: string): Message[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC')
      .all(threadId) as MessageRow[]
    return rows.map(this.toMessage)
  }

  private broadcastThreadUpdate(threadId: string): void {
    const thread = this.getThread(threadId)
    if (!thread) return
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('thread:update', thread)
    }
  }

  private toThread(row: ThreadRow): Thread {
    return {
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      provider: row.provider as Thread['provider'],
      model: row.model,
      status: (row.status as ThreadStatus) || 'idle',
      archivedAt: row.archived_at,
      sortOrder: Number(row.sort_order ?? 0),
      lastActivityAt: row.last_activity_at || row.updated_at,
      latestTurnId: row.latest_turn_id,
      hasPendingApproval: Boolean(row.has_pending_approval),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private toMessage(row: MessageRow): Message {
    return {
      id: row.id,
      threadId: row.thread_id,
      role: row.role as Message['role'],
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      createdAt: row.created_at
    }
  }
}

export const threadService = new ThreadService()
