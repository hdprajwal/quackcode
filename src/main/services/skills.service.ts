import { BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import type {
  InstalledSkill,
  SkillDetails,
  SkillEvent,
  SkillInstallParams,
  SkillListing,
  SkillSearchParams,
  SkillUninstallParams
} from '@shared/types'

const SKILLS_SH_SEARCH = 'https://skills.sh/api/search'
const USER_AGENT = 'quackcode'

// Agent display names from `skills ls --json` agents[] back to canonical IDs.
// Keep in sync with the output from `npx skills --help` valid agents.
const AGENT_LABEL_TO_ID: Record<string, string> = {
  'Claude Code': 'claude-code',
  Codex: 'codex',
  OpenCode: 'opencode',
  Cursor: 'cursor',
  'Gemini CLI': 'gemini-cli',
  'GitHub Copilot': 'github-copilot',
  Windsurf: 'windsurf',
  Amp: 'amp',
  Antigravity: 'antigravity',
  Augment: 'augment',
  Cline: 'cline',
  Continue: 'continue',
  Crush: 'crush',
  Goose: 'goose',
  Junie: 'junie',
  Roo: 'roo',
  Warp: 'warp'
}

interface RawInstalledSkill {
  name: string
  path: string
  scope: 'global' | 'project'
  agents: string[]
}

const METADATA_FILE = '.quackcode-skill.json'

interface SkillMetadataFile {
  source: string
  installedAt: string
  agents?: string[]
}

async function readMetadata(skillPath: string): Promise<SkillMetadataFile | null> {
  try {
    const raw = await fs.readFile(join(skillPath, METADATA_FILE), 'utf8')
    return JSON.parse(raw) as SkillMetadataFile
  } catch {
    return null
  }
}

async function writeMetadata(skillPath: string, meta: SkillMetadataFile): Promise<void> {
  try {
    await fs.writeFile(join(skillPath, METADATA_FILE), JSON.stringify(meta, null, 2), 'utf8')
  } catch {
    // Metadata is best-effort — its absence just means "upstream unknown".
  }
}

async function readLocalSkillMd(skillPath: string): Promise<string | null> {
  try {
    return await fs.readFile(join(skillPath, 'SKILL.md'), 'utf8')
  } catch {
    return null
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }
  })
  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText}`)
  }
  return await response.text()
}

function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, string>
  body: string
} {
  if (!markdown.startsWith('---')) {
    return { frontmatter: {}, body: markdown }
  }

  const end = markdown.indexOf('\n---', 3)
  if (end === -1) {
    return { frontmatter: {}, body: markdown }
  }

  const header = markdown.slice(3, end).trim()
  const body = markdown.slice(end + 4).replace(/^\n/, '')
  const frontmatter: Record<string, string> = {}

  let currentKey: string | null = null
  for (const rawLine of header.split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line) continue

    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line)
    if (match) {
      currentKey = match[1]
      frontmatter[currentKey] = stripQuotes(match[2])
    } else if (currentKey && /^\s+/.test(rawLine)) {
      frontmatter[currentKey] = `${frontmatter[currentKey]} ${line.trim()}`.trim()
    }
  }

  return { frontmatter, body }
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseSource(source: string): { owner: string; repo: string } {
  const [owner, repo] = source.split('/')
  if (!owner || !repo) {
    throw new Error(`Invalid skill source: ${source}`)
  }
  return { owner, repo }
}

interface SkillsCliResult {
  stdout: string
  stderr: string
  code: number
}

// Spawn the `skills` CLI via npx. We always pass -y and -g so there are no
// interactive prompts and we install at user scope (per-agent directories).
async function runSkillsCli(args: string[]): Promise<SkillsCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'skills', ...args], {
      env: { ...process.env, DISABLE_TELEMETRY: '1', CI: '1', FORCE_COLOR: '0' },
      shell: false
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 })
    })
  })
}

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
}

async function toInstalledSkill(raw: RawInstalledSkill): Promise<InstalledSkill> {
  const meta = await readMetadata(raw.path)
  const markdown = await readLocalSkillMd(raw.path)
  const { frontmatter } = markdown
    ? parseFrontmatter(markdown)
    : { frontmatter: {} as Record<string, string> }

  // Prefer the list the user selected at install time. `skills ls --json` only
  // reports agents with dedicated per-agent directories, missing agents that
  // read from the shared `~/.agents/skills/` store (Codex, Cursor, OpenCode…).
  const reportedAgents = raw.agents.map(
    (label) => AGENT_LABEL_TO_ID[label] ?? label.toLowerCase().replace(/\s+/g, '-')
  )
  const agents = (meta?.agents && meta.agents.length > 0 ? meta.agents : reportedAgents)
    .slice()
    .sort()

  return {
    skillId: raw.name,
    name: frontmatter.name ?? raw.name,
    path: raw.path,
    scope: raw.scope,
    agents,
    source: meta?.source ?? null,
    description: frontmatter.description ?? ''
  }
}

export class SkillsService {
  async listInstalled(): Promise<InstalledSkill[]> {
    const result = await runSkillsCli(['ls', '-g', '--json'])
    if (result.code !== 0) {
      throw new Error(`skills ls failed: ${stripAnsi(result.stderr || result.stdout).trim()}`)
    }

    const raw = JSON.parse(result.stdout) as RawInstalledSkill[]
    const skills = await Promise.all(raw.map(toInstalledSkill))
    return skills.sort((a, b) => a.name.localeCompare(b.name))
  }

  async search({ query, limit }: SkillSearchParams): Promise<SkillListing[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    const params = new URLSearchParams({ q: trimmed })
    if (limit && limit > 0) params.set('limit', String(limit))

    const data = await fetchJson<{ skills?: SkillListing[] }>(`${SKILLS_SH_SEARCH}?${params}`)
    return data.skills ?? []
  }

  async getDetails({
    source,
    skillId
  }: {
    source: string
    skillId: string
  }): Promise<SkillDetails> {
    const { owner, repo } = parseSource(source)
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/skills/${skillId}/SKILL.md`
    const markdown = await fetchText(rawUrl)
    const { frontmatter, body } = parseFrontmatter(markdown)

    return {
      id: `${source}/${skillId}`,
      skillId,
      source,
      name: frontmatter.name ?? skillId,
      description: frontmatter.description ?? '',
      body,
      licenseNotice: frontmatter.license ?? null,
      installs: null
    }
  }

  async getLocalDetails({
    path,
    skillId
  }: {
    path: string
    skillId: string
  }): Promise<SkillDetails> {
    const markdown = (await readLocalSkillMd(path)) ?? ''
    const { frontmatter, body } = parseFrontmatter(markdown)
    const meta = await readMetadata(path)

    return {
      id: `local:${skillId}`,
      skillId,
      source: meta?.source ?? '',
      name: frontmatter.name ?? skillId,
      description: frontmatter.description ?? '',
      body,
      licenseNotice: frontmatter.license ?? null,
      installs: null
    }
  }

  async install({ source, skillId, agents }: SkillInstallParams): Promise<InstalledSkill> {
    if (agents.length === 0) {
      throw new Error('Select at least one agent to install the skill to.')
    }

    const args = ['add', source, '-g', '-y', '--copy', '--skill', skillId, '--agent', ...agents]

    const result = await runSkillsCli(args)
    if (result.code !== 0) {
      const detail = stripAnsi(result.stderr || result.stdout)
        .trim()
        .slice(-400)
      throw new Error(`skills add failed: ${detail}`)
    }

    const installed = (await this.listInstalled()).find((s) => s.skillId === skillId)
    if (!installed) {
      throw new Error(`Skill ${skillId} installed but not visible in 'skills ls'.`)
    }

    // Merge with any agents recorded previously so "install on additional agents"
    // accumulates instead of replacing.
    const existingMeta = await readMetadata(installed.path)
    const mergedAgents = Array.from(
      new Set([...(existingMeta?.agents ?? []), ...installed.agents, ...agents])
    ).sort()

    await writeMetadata(installed.path, {
      source,
      installedAt: existingMeta?.installedAt ?? new Date().toISOString(),
      agents: mergedAgents
    })
    installed.source = source
    installed.agents = mergedAgents

    this.broadcast({ type: 'skill:installed', skill: installed })
    return installed
  }

  async uninstall({ skillId, agents }: SkillUninstallParams): Promise<void> {
    const existing = (await this.listInstalled()).find((s) => s.skillId === skillId)

    if (!agents || agents.length === 0) {
      // Full removal — delegate to CLI.
      const result = await runSkillsCli(['rm', skillId, '-g', '-y'])
      if (result.code !== 0) {
        const detail = stripAnsi(result.stderr || result.stdout)
          .trim()
          .slice(-400)
        throw new Error(`skills rm failed: ${detail}`)
      }
      this.broadcast({ type: 'skill:uninstalled', skillId })
      return
    }

    // Per-agent removal. The CLI handles this for agents with dedicated per-agent
    // directories; for shared-store agents we just update our metadata since the
    // files remain in `~/.agents/skills/` until the last agent is removed.
    const cliResult = await runSkillsCli(['rm', skillId, '-g', '-y', '--agent', ...agents])
    if (cliResult.code !== 0) {
      const detail = stripAnsi(cliResult.stderr || cliResult.stdout)
        .trim()
        .slice(-400)
      throw new Error(`skills rm failed: ${detail}`)
    }

    const remaining = existing ? existing.agents.filter((agent) => !agents.includes(agent)) : []

    if (remaining.length === 0) {
      // User removed the last remaining agent — remove the skill entirely.
      await runSkillsCli(['rm', skillId, '-g', '-y'])
      this.broadcast({ type: 'skill:uninstalled', skillId })
      return
    }

    if (existing) {
      const meta = await readMetadata(existing.path)
      if (meta) {
        await writeMetadata(existing.path, { ...meta, agents: remaining })
      }
      const updated: InstalledSkill = { ...existing, agents: remaining }
      this.broadcast({ type: 'skill:installed', skill: updated })
    }
  }

  private broadcast(event: SkillEvent): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('skills:event', event)
    }
  }
}

export const skillsService = new SkillsService()
