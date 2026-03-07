import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import type { Thread, Message, CreateThreadParams, CreateMessageParams } from '@shared/types'

export class ThreadService {
  createThread(params: CreateThreadParams): Thread {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()
    const title = params.title || 'New Thread'

    db.prepare(
      'INSERT INTO threads (id, title, project_id, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title, params.projectId, params.provider, params.model, now, now)

    return {
      id,
      title,
      projectId: params.projectId,
      provider: params.provider,
      model: params.model,
      createdAt: now,
      updatedAt: now
    }
  }

  listThreads(projectId: string): Thread[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId) as Record<string, string>[]
    return rows.map(this.toThread)
  }

  listAllThreads(): Thread[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM threads ORDER BY updated_at DESC')
      .all() as Record<string, string>[]
    return rows.map(this.toThread)
  }

  getThread(threadId: string): Thread | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId) as
      | Record<string, string>
      | undefined
    return row ? this.toThread(row) : null
  }

  deleteThread(threadId: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM threads WHERE id = ?').run(threadId)
  }

  updateTitle(threadId: string, title: string): void {
    const db = getDatabase()
    db.prepare('UPDATE threads SET title = ?, updated_at = datetime(?) WHERE id = ?').run(
      title,
      new Date().toISOString(),
      threadId
    )
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

    // Update thread's updated_at
    db.prepare('UPDATE threads SET updated_at = datetime(?) WHERE id = ?').run(
      now,
      params.threadId
    )

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
      .all(threadId) as Record<string, string>[]
    return rows.map(this.toMessage)
  }

  private toThread(row: Record<string, string>): Thread {
    return {
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      provider: row.provider as Thread['provider'],
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private toMessage(row: Record<string, string>): Message {
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
