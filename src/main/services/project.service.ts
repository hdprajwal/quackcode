import { v4 as uuidv4 } from 'uuid'
import { basename } from 'path'
import { getDatabase } from '../db/database'
import type { Project } from '@shared/types'

export class ProjectService {
  openProject(path: string): Project {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as
      | Record<string, string>
      | undefined

    if (existing) {
      db.prepare('UPDATE projects SET last_opened_at = datetime(?) WHERE id = ?').run(
        new Date().toISOString(),
        existing.id
      )
      return this.toProject(existing)
    }

    const project: Project = {
      id: uuidv4(),
      name: basename(path),
      path,
      lastOpenedAt: new Date().toISOString()
    }

    db.prepare('INSERT INTO projects (id, name, path, last_opened_at) VALUES (?, ?, ?, ?)').run(
      project.id,
      project.name,
      project.path,
      project.lastOpenedAt
    )

    return project
  }

  listProjects(): Project[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM projects ORDER BY last_opened_at DESC')
      .all() as Record<string, string>[]
    return rows.map(this.toProject)
  }

  getProject(id: string): Project | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | Record<string, string>
      | undefined
    return row ? this.toProject(row) : null
  }

  private toProject(row: Record<string, string>): Project {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      lastOpenedAt: row.last_opened_at
    }
  }
}

export const projectService = new ProjectService()
