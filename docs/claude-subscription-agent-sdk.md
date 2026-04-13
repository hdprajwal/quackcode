# Using Claude Agent SDK with Your Subscription

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) can authenticate using your existing Claude Pro/Max subscription — no API key required. This works by pointing the SDK at your locally-authenticated `claude` binary.

This document explains the full flow, from authentication to building a general-purpose agent.

## Prerequisites

- Node.js 18+
- Claude Code CLI installed and authenticated (`claude auth login`)
- An active Claude Pro or Max subscription

## How It Works

The Agent SDK accepts a `pathToClaudeCodeExecutable` option. When provided, the SDK delegates authentication to the `claude` binary, which already holds your subscription token from `claude auth login`. No API key is ever passed explicitly.

```
[Your Script] → [Agent SDK] → [claude binary (authenticated)] → [Anthropic API]
```

## Step 1: Authenticate Claude Code

Run the OAuth login flow once:

```bash
claude auth login
```

This stores your subscription token securely on your machine. Verify it worked:

```bash
claude auth status
```

You should see your subscription type (Pro/Max) in the JSON output.

## Step 2: Install the Agent SDK

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Step 3: Basic Usage

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const session = query({
  prompt: "List all running processes using more than 1GB of memory",
  options: {
    pathToClaudeCodeExecutable: "claude", // uses your local authenticated binary
    model: "claude-sonnet-4-6",
    permissionMode: "bypassPermissions", // allows tool use without prompts
    allowedTools: ["Bash", "Read", "Write", "Glob", "Grep"],
  },
});

// Stream results
for await (const message of session) {
  if (message.type === "assistant" && message.content) {
    console.log(message.content);
  }
}
```

## Step 4: Reading the Initialization Result

You can probe the session to confirm subscription info:

```typescript
const session = query({
  prompt: ".",
  options: {
    pathToClaudeCodeExecutable: "claude",
    maxTurns: 0, // abort immediately after init — no API calls made
    persistSession: false,
  },
});

const init = await session.initializationResult();
console.log("Subscription:", init.account?.subscriptionType);
// Output: "pro" or "max"
```

## Step 5: General-Purpose Agent (No Dev Restrictions)

The key advantage over `claude -p` is that the Agent SDK does **not** enforce the "software engineering only" system prompt. You control the system prompt entirely:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function runAgent(task: string) {
  const session = query({
    prompt: task,
    options: {
      pathToClaudeCodeExecutable: "claude",
      model: "claude-sonnet-4-6",
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash", "Read", "Write", "Glob", "Grep"],
    },
  });

  for await (const message of session) {
    if (message.type === "assistant") {
      process.stdout.write(String(message.content ?? ""));
    }
  }
}

// These work — no "I'm meant for software engineering" refusal
runAgent("Organize my ~/Downloads folder by file type");
runAgent("Find all duplicate photos in ~/Pictures");
runAgent("Set up a cron job that backs up my documents daily");
```

## Quick Reference: CLI Approach

For simpler one-off tasks, you can also shell out to the `claude` binary directly. Reframe non-dev tasks as scripts to avoid the system prompt restriction:

```bash
# This may get refused:
claude -p "organize my downloads folder"

# This works — framed as a coding task:
claude -p "write and execute a bash script that organizes ~/Downloads by file type"

# Structured output:
claude -p --output-format json --model claude-sonnet-4-6 "write a script that lists duplicate files in ~/Pictures"
```

## How t3code Does It

This pattern is taken from [t3code](https://github.com/pingdotgg/t3code), a GUI wrapper for Claude Code. Key files:

- **Authentication probe**: Runs `claude auth status` to detect subscription type
- **Session creation**: Uses `query()` with `pathToClaudeCodeExecutable` — no API key
- **Text generation**: Falls back to `claude -p --output-format json` for simple tasks

Relevant t3code source:
```typescript
// From ClaudeAdapter.ts — how t3code creates sessions
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk";

const queryRuntime = claudeQuery({
  prompt: input.prompt,
  options: {
    cwd: input.cwd,
    model: "claude-opus-4-6",
    pathToClaudeCodeExecutable: claudeBinaryPath,
    permissionMode: "bypassPermissions",
    // subscription auth is handled automatically
  },
});
```

## Notes

- **Cost**: This uses your subscription quota, not pay-per-token API billing
- **Rate limits**: Subject to your subscription's rate limits (Pro/Max tiers differ)
- **Linux**: This is the best path for Linux users since the Claude desktop app and Cowork are not available on Linux
- **Models**: You can use any model available on your subscription tier
