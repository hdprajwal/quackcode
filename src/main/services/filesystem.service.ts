import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join, resolve, relative, dirname } from 'path'
import type { FileEntry, FileReadResult, SearchResult } from '@shared/types'

export class FilesystemService {
  private validatePath(filePath: string, projectPath: string): string {
    const resolved = resolve(projectPath, filePath)
    const rel = relative(projectPath, resolved)
    if (rel.startsWith('..') || resolve(resolved) !== resolved.replace(/\/$/, '')) {
      throw new Error(`Path traversal denied: ${filePath}`)
    }
    return resolved
  }

  readFile(filePath: string, projectPath: string): FileReadResult {
    const resolved = this.validatePath(filePath, projectPath)
    const content = readFileSync(resolved, 'utf-8')
    return { content, path: relative(projectPath, resolved) }
  }

  writeFile(filePath: string, content: string, projectPath: string): void {
    const resolved = this.validatePath(filePath, projectPath)
    mkdirSync(dirname(resolved), { recursive: true })
    writeFileSync(resolved, content, 'utf-8')
  }

  editFile(filePath: string, oldString: string, newString: string, projectPath: string): void {
    const resolved = this.validatePath(filePath, projectPath)
    const content = readFileSync(resolved, 'utf-8')
    if (!content.includes(oldString)) {
      throw new Error(`String not found in file: ${filePath}`)
    }
    const updated = content.replace(oldString, newString)
    writeFileSync(resolved, updated, 'utf-8')
  }

  listDirectory(
    dirPath: string,
    projectPath: string,
    recursive = false,
    maxDepth = 3
  ): FileEntry[] {
    const resolved = this.validatePath(dirPath, projectPath)
    return this._listDir(resolved, projectPath, recursive, maxDepth, 0)
  }

  private _listDir(
    dir: string,
    projectPath: string,
    recursive: boolean,
    maxDepth: number,
    depth: number
  ): FileEntry[] {
    if (!existsSync(dir)) return []
    const entries: FileEntry[] = []
    const items = readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue
      const fullPath = join(dir, item.name)
      const relPath = relative(projectPath, fullPath)
      const isDir = item.isDirectory()

      entries.push({
        name: item.name,
        path: relPath,
        isDirectory: isDir,
        size: isDir ? undefined : statSync(fullPath).size
      })

      if (recursive && isDir && depth < maxDepth) {
        entries.push(...this._listDir(fullPath, projectPath, recursive, maxDepth, depth + 1))
      }
    }

    return entries
  }

  searchFiles(
    pattern: string,
    dirPath: string,
    projectPath: string,
    maxResults = 50
  ): SearchResult[] {
    const resolved = this.validatePath(dirPath, projectPath)
    const results: SearchResult[] = []
    const regex = new RegExp(pattern, 'gi')
    this._searchDir(resolved, projectPath, regex, results, maxResults, 0)
    return results
  }

  private _searchDir(
    dir: string,
    projectPath: string,
    regex: RegExp,
    results: SearchResult[],
    maxResults: number,
    depth: number
  ): void {
    if (results.length >= maxResults || depth > 5 || !existsSync(dir)) return

    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (results.length >= maxResults) return
      if (item.name.startsWith('.') || item.name === 'node_modules') continue

      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        this._searchDir(fullPath, projectPath, regex, results, maxResults, depth + 1)
      } else {
        try {
          const stat = statSync(fullPath)
          if (stat.size > 1024 * 1024) continue // Skip files > 1MB

          const content = readFileSync(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                file: relative(projectPath, fullPath),
                line: i + 1,
                content: lines[i].trim().substring(0, 200)
              })
              if (results.length >= maxResults) return
            }
            regex.lastIndex = 0
          }
        } catch {
          // Skip binary/unreadable files
        }
      }
    }
  }
}

export const filesystemService = new FilesystemService()
