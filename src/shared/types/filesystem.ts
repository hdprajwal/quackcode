export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
}

export interface FileReadResult {
  content: string
  path: string
}

export interface FileWriteParams {
  path: string
  content: string
  projectPath: string
}

export interface FileEditParams {
  path: string
  oldString: string
  newString: string
  projectPath: string
}

export interface ListDirectoryParams {
  path: string
  projectPath: string
  recursive?: boolean
  maxDepth?: number
}

export interface SearchFilesParams {
  pattern: string
  path: string
  projectPath: string
  maxResults?: number
}

export interface SearchResult {
  file: string
  line: number
  content: string
}
