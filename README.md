# QuackCode

An AI-powered agentic coding assistant built with Electron, React, and TypeScript. Named after the rubber duck debugging method — except this duck talks back.

## Why this exists

Anthropic released Claude Code. OpenAI released Codex. Every major AI coding tool drops on Mac and Windows first — and Linux either comes months later or not at all.

I got tired of waiting, so I built my own. QuackCode gives me the same agentic coding experience on Linux, and since I own the code I can plug in new models the day they're released without waiting for anyone else's release schedule.

This is a personal project built for my own use. If you're in the same boat — on Linux, subscribed to these AI services, and done waiting — it might work for you too.

## What it does

QuackCode runs AI agents that autonomously work through coding tasks end-to-end: reading files, writing and editing code, searching the codebase, running git operations, and committing changes — without needing step-by-step instructions.

## Features

- **Agentic coding** — give it a task, it plans and executes it autonomously using file, git, and search tools
- **Multi-provider** — supports Anthropic (Claude), OpenAI, and Google Gemini; planned support for OpenAI Codex app server (to use a ChatGPT subscription)
- **Claude Pro auth** — authenticate using your existing Claude Code session, no API key needed
- **Project management** — open any local repo and switch between projects
- **Git worktrees** — run agents in isolated worktrees to keep your working tree clean
- **Streaming UI** — see responses and tool calls stream in real time
- **Threaded history** — every conversation is persisted and searchable

## Getting started

### Install dependencies

```bash
npm install
```

### Configure a provider

Launch the app and open **Settings** (⌘, / Ctrl+,). You can authenticate with:

**API key** — paste a key from [console.anthropic.com](https://console.anthropic.com), [platform.openai.com](https://platform.openai.com), or [aistudio.google.com](https://aistudio.google.com)

**Claude Pro** — if you have Claude Code installed and signed in, click *Use Claude Code session* under the Anthropic provider. No API key or registration required.

### Run in development

```bash
npm run dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## Tech stack

- **Electron** + **electron-vite** — app shell and build tooling
- **React** + **TypeScript** — renderer UI
- **Tailwind CSS** — styling
- **better-sqlite3** — local persistence for projects, threads, and messages
- **@anthropic-ai/sdk**, **openai**, **@google/genai** — AI provider SDKs
- **simple-git** — git operations

## Project structure

```
src/
├── main/           # Electron main process
│   ├── ipc/        # IPC handlers
│   ├── services/   # AI, agent, git, project, settings, thread logic
│   └── tools/      # Tool definitions for the agent (file, git, search)
├── preload/        # Context bridge
├── renderer/       # React app
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       └── stores/
└── shared/         # Types shared between main and renderer
```
