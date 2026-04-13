# Projects & Threads UX

This doc describes the sidebar and per-thread activity UX shipped in QuackCode.

## Overview

The left sidebar renders **projects → threads** as a nested tree. Each thread row
exposes live status, a last-activity timestamp, and interaction affordances
(rename, archive, reorder, delete). A collapsible **Archived** section sits at the
bottom of the sidebar. A selection bar appears when more than one thread is
selected and supports bulk archive / delete.

The chat view includes a collapsible **Activity** panel that renders a stream of
recorded `thread_events` grouped by turn — tool runs, approvals, errors, and
turn boundaries.

## Data model

- `threads` gains: `status`, `archived_at`, `sort_order`, `last_activity_at`,
  `latest_turn_id`, `has_pending_approval`.
- New `thread_events` table: append-only log with `sequence`, `turn_id`, `kind`,
  `tone` (`info` | `tool` | `approval` | `error`), `summary`, and a JSON payload.

## Event emission

`agent.service.ts` emits events at turn start/completed/error and around every
tool call (`tool.started` / `tool.completed` / `tool.failed`). Additional kinds
(`approval.requested`, `approval.resolved`, `runtime.warning`, `note`) are
reserved for future approval and background flows.

## Sidebar interactions

- **Click** a thread — switch to it.
- **Cmd/Ctrl+click** — toggle selection for multi-select.
- **Shift+click** — range-select within a project group.
- **Double-click** — inline rename.
- **Right-click** (or `…` menu) — rename / move up / move down / archive /
  delete.
- **Cmd/Ctrl + 1–9** — quick-jump to the nth active thread across the whole
  sidebar.
- **Escape** — clear multi-selection.

## IPC surface

New invoke channels: `thread:listAll`, `thread:deleteMany`, `thread:archive`,
`thread:unarchive`, `thread:archiveMany`, `thread:reorder`,
`thread-event:list`.

New push channel: `thread-event:new` carries both the new event and the
updated thread row for live sidebar refresh.

## Credits

The overall information architecture for this feature — nested
projects/threads with a dedicated thread-event activity log, status indicators
folded into the sidebar, and a derived activity feed grouped by turn — was
informed by the design of [t3code](https://github.com/t3dotgg/t3code). QuackCode
does **not** adopt t3code's event-sourced backend; all state is persisted
directly via SQLite with a small append-only `thread_events` table, mutated by
plain services.
