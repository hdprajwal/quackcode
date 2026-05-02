// A skill entry as returned by the skills.sh catalog search API.
export interface SkillListing {
  id: string
  skillId: string
  name: string
  source: string
  installs: number
}

// Detailed metadata for a specific skill, including the body of SKILL.md.
export interface SkillDetails {
  id: string
  skillId: string
  name: string
  source: string
  description: string
  body: string
  licenseNotice: string | null
  installs: number | null
}

// A skill currently installed via the `skills` CLI (global scope).
export interface InstalledSkill {
  skillId: string
  name: string
  path: string
  scope: 'global' | 'project'
  agents: string[]
  source: string | null
  description: string
}

export interface SkillInstallParams {
  source: string
  skillId: string
  agents: string[]
}

export interface SkillUninstallParams {
  skillId: string
  agents?: string[]
}

export interface SkillSearchParams {
  query: string
  limit?: number
}

// Agents selectable in the UI. IDs match `skills --agent <id>` from skills.sh.
export interface SupportedAgent {
  id: string
  label: string
  default: boolean
}

export const SUPPORTED_AGENTS: SupportedAgent[] = [
  { id: 'claude-code', label: 'Claude Code', default: true },
  { id: 'codex', label: 'Codex', default: false },
  { id: 'opencode', label: 'OpenCode', default: false },
  { id: 'cursor', label: 'Cursor', default: false },
  { id: 'gemini-cli', label: 'Gemini CLI', default: false },
  { id: 'github-copilot', label: 'GitHub Copilot', default: false },
  { id: 'windsurf', label: 'Windsurf', default: false }
]

export type SkillEvent =
  | { type: 'skill:installed'; skill: InstalledSkill }
  | { type: 'skill:uninstalled'; skillId: string }
