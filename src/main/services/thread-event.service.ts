import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { threadService } from './thread.service'
import type {
  AppendThreadEventParams,
  ThreadEvent,
  ThreadEventTone,
  ThreadEventKind,
  ThreadEventNotification
} from '@shared/types'

interface ThreadEventRow {
  id: string
  thread_id: string
  turn_id: string | null
  sequence: number
  kind: string
  tone: string
  summary: string
  payload: string | null
  created_at: string
}

export class ThreadEventService {
  append(params: AppendThreadEventParams): ThreadEvent {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()
    const payloadJson = params.payload ? JSON.stringify(params.payload) : null

    const result = db.transaction((): ThreadEvent => {
      const nextSeqRow = db
        .prepare(
          'SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM thread_events WHERE thread_id = ?'
        )
        .get(params.threadId) as { next: number }

      db.prepare(
        `INSERT INTO thread_events (id, thread_id, turn_id, sequence, kind, tone, summary, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        params.threadId,
        params.turnId ?? null,
        nextSeqRow.next,
        params.kind,
        params.tone,
        params.summary,
        payloadJson,
        now
      )

      return {
        id,
        threadId: params.threadId,
        turnId: params.turnId ?? null,
        sequence: nextSeqRow.next,
        kind: params.kind as ThreadEventKind,
        tone: params.tone as ThreadEventTone,
        summary: params.summary,
        payload: params.payload ?? null,
        createdAt: now
      }
    })()

    // Reflect relevant events on the thread row for sidebar display.
    this.applyEventToThread(result)

    // Broadcast
    const updatedThread = threadService.getThread(params.threadId)
    if (updatedThread) {
      const notification: ThreadEventNotification = {
        type: 'thread-event:new',
        event: result,
        thread: updatedThread
      }
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        win.webContents.send('thread-event:new', notification)
      }
    }

    return result
  }

  list(threadId: string, limit = 500): ThreadEvent[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        'SELECT * FROM thread_events WHERE thread_id = ? ORDER BY sequence ASC LIMIT ?'
      )
      .all(threadId, limit) as ThreadEventRow[]
    return rows.map(this.toEvent)
  }

  private applyEventToThread(event: ThreadEvent): void {
    switch (event.kind) {
      case 'turn.started':
        threadService.updateStatus(event.threadId, 'running', event.turnId)
        break
      case 'turn.completed':
        threadService.updateStatus(event.threadId, 'completed', event.turnId)
        break
      case 'turn.error':
      case 'runtime.error':
      case 'tool.failed':
        threadService.updateStatus(event.threadId, 'error', event.turnId)
        break
      case 'approval.requested':
        threadService.setPendingApproval(event.threadId, true)
        break
      case 'approval.resolved':
        threadService.setPendingApproval(event.threadId, false)
        break
      default:
        threadService.bumpActivity(event.threadId)
        break
    }
  }

  private toEvent(row: ThreadEventRow): ThreadEvent {
    return {
      id: row.id,
      threadId: row.thread_id,
      turnId: row.turn_id,
      sequence: row.sequence,
      kind: row.kind as ThreadEventKind,
      tone: row.tone as ThreadEventTone,
      summary: row.summary,
      payload: row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : null,
      createdAt: row.created_at
    }
  }
}

export const threadEventService = new ThreadEventService()
