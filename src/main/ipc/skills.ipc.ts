import { ipcMain } from 'electron'
import { skillsService } from '../services/skills.service'
import type { SkillInstallParams, SkillSearchParams, SkillUninstallParams } from '@shared/types'

const SKILL_ID_RE = /^[a-zA-Z0-9._-]+$/
const SOURCE_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/

function assertSkillId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || !SKILL_ID_RE.test(value)) {
    throw new Error('Invalid skillId')
  }
}

function assertSource(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || !SOURCE_RE.test(value)) {
    throw new Error('Invalid source')
  }
}

function assertAgents(value: unknown, { allowEmpty = false } = {}): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error('Invalid agents')
  if (!allowEmpty && value.length === 0) throw new Error('Invalid agents: must not be empty')
  if (value.length > 32) throw new Error('Invalid agents: too many entries')
  for (const agent of value) {
    if (typeof agent !== 'string' || !SKILL_ID_RE.test(agent) || agent.length > 64) {
      throw new Error('Invalid agent id')
    }
  }
}

function assertSearchQuery(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 256) {
    throw new Error('Invalid search query')
  }
}

export function registerSkillsIpc(): void {
  ipcMain.handle('skills:listInstalled', () => {
    return skillsService.listInstalled()
  })

  ipcMain.handle('skills:search', (_event, raw) => {
    const params = (raw ?? {}) as Partial<SkillSearchParams>
    assertSearchQuery(params.query)
    const limit =
      typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0
        ? Math.min(Math.floor(params.limit), 100)
        : undefined
    return skillsService.search({ query: params.query, limit })
  })

  ipcMain.handle('skills:details', (_event, raw) => {
    const params = (raw ?? {}) as { source?: unknown; skillId?: unknown }
    assertSource(params.source)
    assertSkillId(params.skillId)
    return skillsService.getDetails({ source: params.source, skillId: params.skillId })
  })

  // `path` is not validated as a string regex — it's resolved against the list
  // of skills the CLI actually reports as installed, which is the only way to
  // prevent traversal/arbitrary-read.
  ipcMain.handle('skills:localDetails', async (_event, raw) => {
    const params = (raw ?? {}) as { path?: unknown; skillId?: unknown }
    assertSkillId(params.skillId)
    if (typeof params.path !== 'string' || params.path.length === 0 || params.path.length > 1024) {
      throw new Error('Invalid path')
    }
    return skillsService.getLocalDetails({ path: params.path, skillId: params.skillId })
  })

  ipcMain.handle('skills:install', (_event, raw) => {
    const params = (raw ?? {}) as Partial<SkillInstallParams>
    assertSource(params.source)
    assertSkillId(params.skillId)
    assertAgents(params.agents)
    return skillsService.install({
      source: params.source,
      skillId: params.skillId,
      agents: params.agents
    })
  })

  ipcMain.handle('skills:uninstall', (_event, raw) => {
    const params = (raw ?? {}) as Partial<SkillUninstallParams>
    assertSkillId(params.skillId)
    if (params.agents !== undefined) assertAgents(params.agents, { allowEmpty: true })
    return skillsService.uninstall({ skillId: params.skillId, agents: params.agents })
  })
}
