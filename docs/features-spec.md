# OpenDev Features Specification

## Claude Pro Authentication

Users can authenticate with Anthropic using their Claude Pro/Max subscription instead of a paid API key, by reusing the session that Claude Code has already established locally.

### Overview

The Anthropic provider supports two auth modes: `apiKey` (existing) and `claudePro`. When Claude Pro mode is active, the access token is read directly from Claude Code's credentials file (`~/.claude/.credentials.json`) on every request — no separate login or token storage needed. The Anthropic SDK is initialized with that token via `authToken` + `baseURL: 'https://api.claude.ai/api'`, both natively supported since `@anthropic-ai/sdk` v0.39.

### Architecture

```
Renderer (UI)                 Main Process (Electron)
─────────────────────         ──────────────────────────────────────
ProviderSettings.tsx          settings.ipc.ts
  ├─ Auth mode toggle    ──── auth:claudePro:connect
  ├─ "Use Claude Code         │  ├─ Read ~/.claude/.credentials.json
  │   session" button         │  ├─ Validate token exists + not expired
  └─ Logout button      ──── auth:claudePro:logout
                              │  └─ Store authMode flag in electron-store
                              │
                         ai.service.ts
                              ├─ On each request, reads credentials file fresh
                              ├─ authMode === 'claudePro' → readClaudeCodeToken()
                              │    └─ AnthropicProvider.setAuthToken(accessToken)
                              └─ authMode === 'apiKey'    → setApiKey(key)
```

### Credentials File

Claude Code stores OAuth tokens at `~/.claude/.credentials.json`:

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1772838905152,
    "subscriptionType": "pro",
    "scopes": ["user:inference", "user:profile", ...]
  }
}
```

Token refresh is handled by Claude Code itself. If the token is expired, the user is prompted to open Claude Code, which refreshes it automatically.

### Changed Files

| File | Change |
|------|--------|
| `src/shared/types/settings.ts` | `ProviderConfig` gains `authMode?: 'apiKey' \| 'claudePro'` |
| `src/shared/types/ipc.ts` | New channels: `auth:claudePro:connect`, `auth:claudePro:logout` |
| `src/main/services/ai/claude-credentials.ts` | New — reads and validates `~/.claude/.credentials.json` |
| `src/main/services/ai/anthropic.provider.ts` | `setAuthToken(token)` — creates SDK client with `authToken` + Claude.ai base URL |
| `src/main/services/ai/ai.service.ts` | `getProvider` reads credentials file when `authMode === 'claudePro'` |
| `src/main/ipc/settings.ipc.ts` | `auth:claudePro:connect` validates credentials and saves the flag |
| `src/renderer/src/components/settings/ProviderSettings.tsx` | API Key / Claude Pro tab toggle; connect/logout UI |

### Design Decisions

- **No token storage in our app** — Claude Code owns the token lifecycle; we read the file fresh on every request, so refreshes made by Claude Code are picked up automatically
- **No OAuth client ID needed** — no app registration with Anthropic required; works out of the box for any user who has Claude Code installed and signed in
- **`authToken` + custom `baseURL`** — first-class options in `@anthropic-ai/sdk` v0.39+; no monkey-patching required
- **`authMode` flag only** — the only thing stored in our settings is whether Claude Pro mode is enabled; the actual token never touches our store

---

## Scheduled Automations

Users can define automation jobs that run on a schedule (cron-based), trigger an AI agent in the background, and display the output in the UI once complete.

### Overview

An automation consists of a prompt, a cron schedule, and a project context. The main process runs a scheduler that fires jobs at the specified time, executes the agent, and persists the output. The renderer provides a dedicated Automations section for creating, managing, and viewing run history.

### Architecture

```
Renderer (UI)          Main Process (Electron)
─────────────────      ──────────────────────────────────
AutomationsPage   ──── automation.ipc.ts
  ├─ List/Create         ├─ automation:list
  ├─ Run history         ├─ automation:create
  └─ Output viewer       ├─ automation:delete
                         ├─ automation:run (manual trigger)
                         └─ automation:history

                    automation.service.ts
                      ├─ SchedulerManager (node-cron or croner)
                      ├─ Loads schedules on app start
                      ├─ Fires → agentService.handleMessage()
                      └─ Writes run logs to DB
```

### Data Layer

Two new DB tables added via migration in `database.ts`:

```sql
CREATE TABLE automations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  cron        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE automation_runs (
  id             TEXT PRIMARY KEY,
  automation_id  TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  thread_id      TEXT,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at    TEXT,
  error          TEXT,
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE SET NULL
);
```

Each run creates a real `Thread`, so the full message and tool-call stream is persisted using the existing system.

### Shared Types

File: `src/shared/types/automation.ts`

```ts
export interface Automation {
  id: string
  projectId: string
  title: string
  prompt: string
  cron: string
  provider: AIProvider
  model: string
  enabled: boolean
  createdAt: string
}

export interface AutomationRun {
  id: string
  automationId: string
  status: 'running' | 'completed' | 'failed'
  threadId: string | null
  startedAt: string
  finishedAt: string | null
  error: string | null
}
```

### Main Process

**`automation.service.ts`**
- Uses `node-cron` or `croner`
- On app start, loads all `enabled = 1` automations and schedules them
- On trigger: creates a new `Thread`, calls `agentService.handleMessage()`, writes an `AutomationRun` record
- Streams run internally — no active renderer window required
- Exposes: `create`, `delete`, `enable/disable`, `runNow`, `listRuns`

**`automation.ipc.ts`** — `ipcMain.handle` wrappers for each service method

### Renderer

**Route**: `/automations`

**`AutomationsPage`**
- Left panel: list of automations with enable/disable toggle
- Right panel: create form with title, prompt textarea, cron picker (visual builder + raw input), provider/model selector
- Run History drawer: all runs for a selected automation with status badge, timestamp, and link to open thread output in `ChatArea`

Since each run is a regular `Thread`, clicking a run navigates to that thread in the existing chat view — no extra output rendering needed.

**Live status**: Main process emits `automation:run-update` IPC events so the UI can show a running indicator in real time.

### Implementation Sequence

| Step | What |
|------|------|
| 1 | DB migration — `automations` + `automation_runs` tables |
| 2 | `automation.service.ts` — CRUD + scheduler init |
| 3 | `automation.ipc.ts` — IPC handlers |
| 4 | `preload/index.ts` + `preload/index.d.ts` — expose new channels |
| 5 | Shared types (`automation.ts`) |
| 6 | `AutomationsPage` + cron-picker UI component |
| 7 | Run history drawer + link to thread view |
| 8 | IPC event for live status updates |

### Dependencies

- `node-cron` or `croner` — lightweight scheduler that runs inside the Electron main process

### Design Decisions

- **Runs reuse Threads** — no duplicate output storage; existing `ChatArea` renders run output for free
- **Scheduler lives in main process** — survives renderer refreshes; fires even with no focused window
- **No separate worker/daemon** — keeps the implementation Electron-native and packaging simple
- **Cron stored as string** — flexible schedule support; UI wraps it in a user-friendly picker
