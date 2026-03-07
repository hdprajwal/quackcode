import type { ToolDefinition } from '@shared/types'
import { filesystemService } from '../services/filesystem.service'
import { gitService } from '../services/git.service'

export interface ToolContext {
  projectPath: string
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<string>

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file at the given path relative to the project root.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to project root' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file at the given path. Creates the file if it does not exist, or overwrites it.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        content: { type: 'string', description: 'Content to write to the file' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing an exact string match with a new string. The old_string must be unique in the file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        old_string: { type: 'string', description: 'Exact string to find and replace' },
        new_string: { type: 'string', description: 'String to replace with' }
      },
      required: ['path', 'old_string', 'new_string']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories at the given path relative to the project root.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to project root. Use "." for root.' },
        recursive: { type: 'boolean', description: 'List recursively. Default false.' }
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Search for a regex pattern across files in the project.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in, relative to project root. Use "." for root.' }
      },
      required: ['pattern', 'path']
    }
  },
  {
    name: 'git_status',
    description: 'Get the git status of the project (branch, modified files, staged files, etc.)',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_diff',
    description: 'Get the git diff summary showing changed files with insertion/deletion counts.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and create a git commit with the given message.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' }
      },
      required: ['message']
    }
  }
]

export const toolExecutors: Record<string, ToolExecutor> = {
  read_file: async (args, ctx) => {
    const result = filesystemService.readFile(args.path as string, ctx.projectPath)
    return result.content
  },

  write_file: async (args, ctx) => {
    filesystemService.writeFile(args.path as string, args.content as string, ctx.projectPath)
    return `File written: ${args.path}`
  },

  edit_file: async (args, ctx) => {
    filesystemService.editFile(
      args.path as string,
      args.old_string as string,
      args.new_string as string,
      ctx.projectPath
    )
    return `File edited: ${args.path}`
  },

  list_directory: async (args, ctx) => {
    const entries = filesystemService.listDirectory(
      args.path as string,
      ctx.projectPath,
      args.recursive as boolean | undefined
    )
    return entries
      .map((e) => `${e.isDirectory ? '[dir]' : '[file]'} ${e.path}${e.size ? ` (${e.size}B)` : ''}`)
      .join('\n')
  },

  search_files: async (args, ctx) => {
    const results = filesystemService.searchFiles(
      args.pattern as string,
      args.path as string,
      ctx.projectPath
    )
    if (results.length === 0) return 'No matches found.'
    return results.map((r) => `${r.file}:${r.line}: ${r.content}`).join('\n')
  },

  git_status: async (_args, ctx) => {
    const status = await gitService.getStatus(ctx.projectPath)
    return JSON.stringify(status, null, 2)
  },

  git_diff: async (_args, ctx) => {
    const diff = await gitService.getDiff(ctx.projectPath)
    return JSON.stringify(diff, null, 2)
  },

  git_commit: async (args, ctx) => {
    const hash = await gitService.commit(args.message as string, ctx.projectPath)
    return `Committed: ${hash}`
  }
}
