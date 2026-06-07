---
name: jz-setup-claude-code
description: Initialize or audit a Claude Code installation. Use when setting up a new Claude Code environment, auditing an existing installation, or verifying that all plugins, skills, marketplace sources, statusline, and dependencies are correctly installed and configured. Also use when the user mentions "fresh install", "new machine setup", "check my plugins", "verify my setup", or "what am I missing".
argument-hint: 'Optionally specify "statusline-only" to set up just the statusline, or "audit-only" to skip installation and only report status.'
---

# Claude Code Init

Initializes a Claude Code environment with the full custom setup: statusline, plugins, marketplace sources, and dependency checks. Can also run in audit-only mode to report what's installed vs missing.

## When to Use

- Fresh Claude Code installation that needs the full setup
- Auditing an existing installation for completeness
- After a settings reset or migration to a new machine
- Verifying the statusline is working correctly

## Bundled Resources

This skill ships with two reference files:

| File | Purpose |
|---|---|
| `scripts/statusline-command.sh` | The two-line statusline rendering script — copy directly to `~/.claude/statusline-command.sh` |
| `references/expected-plugins.md` | Full plugin manifest (11 plugins) + marketplace source — read this during the audit step |

## Procedure

### Step 1 — Parse Arguments

Check the user's argument hint:

- `"statusline-only"` → skip plugin/marketplace checks, only set up the statusline
- `"audit-only"` → skip all installation, only report current status
- No argument or anything else → run the full setup + audit

### Step 2 — Check System Dependencies

For each dependency, run the check command and record ✅ or ❌:

| Dependency | Check |
|---|---|
| `jq` | `jq --version` |
| `git` | `git --version` |
| `awk` | `awk --version` |

If any are missing and mode is NOT audit-only, tell the user how to install:

- **jq**: `sudo apt install jq` (Debian/Ubuntu) or `brew install jq` (macOS)
- **git**: `sudo apt install git` or `brew install git`
- **awk**: usually pre-installed as `gawk` or `mawk`

### Step 3 — Set Up the Statusline

Skip this step if running audit-only.

1. Read `scripts/statusline-command.sh` from this skill's directory.
2. Write its content to `~/.claude/statusline-command.sh` using the Write tool.
3. Make it executable: `chmod +x ~/.claude/statusline-command.sh`
4. Safely merge the `statusLine` key into `~/.claude/settings.json` using `jq` — do NOT overwrite the entire file:

```bash
jq '.statusLine = {"type": "command", "command": "bash ~/.claude/statusline-command.sh"}' ~/.claude/settings.json > /tmp/settings-tmp.json && mv /tmp/settings-tmp.json ~/.claude/settings.json
```

If `jq` is not installed, stop and ask the user to install it first — merging JSON without `jq` risks corrupting settings.

### Step 4 — Audit Plugins & Marketplace

Read `references/expected-plugins.md` from this skill's directory for the full manifest.

Then read `~/.claude/settings.json` and check:

1. **Plugins** — the `enabledPlugins` object against all 11 expected plugin keys
2. **Marketplace** — the `extraKnownMarketplaces` object for the `context-mode` entry

For each plugin:
- Key exists and `true` → ✅ installed and enabled
- Key exists and `false` → ⚠️ installed but disabled
- Key missing → ❌ not installed

If NOT audit-only and plugins are missing, inform the user they can install with:
- Official plugins: `/install-plugin <plugin-name>` in Claude Code
- Context-mode marketplace: first add the marketplace source via `jq` (see `references/expected-plugins.md` for the JSON shape), then `/install-plugin context-mode`

### Step 5 — Report

Output a clean status report:

```
╭─────────────────────────────────────────────╮
│  Claude Code Environment Status              │
╰─────────────────────────────────────────────╯

Dependencies
  ✅ jq   — 1.7.1
  ✅ git  — 2.47.1
  ✅ awk  — GNU Awk 5.2.1

Statusline
  ✅ Script   — ~/.claude/statusline-command.sh (executable)
  ✅ Settings — statusLine key configured

Plugins (11/11)
  ✅ frontend-design       ✅ superpowers
  ✅ context7              ✅ skill-creator
  ✅ code-simplifier       ✅ playwright
  ✅ claude-md-management  ✅ typescript-lsp
  ✅ ralph-loop            ✅ claude-code-setup
  ✅ context-mode

Marketplace Sources
  ✅ context-mode — mksglu/context-mode

🎉 All 11 plugins installed, statusline configured, dependencies met.
```

Adapt to what was actually found. If there are issues:

```
❌ 2 missing · ⚠️ 1 disabled

To fix:
  /install-plugin ralph-loop
  /install-plugin context-mode   (add marketplace source first — see references/expected-plugins.md)
  /enable-plugin code-simplifier
```

## Important Notes

- This skill does NOT configure environment variables (API keys, model mappings, base URLs). Those are user-specific — set them manually in `~/.claude/settings.json`.
- The statusline script is self-contained and only depends on `jq`, `git`, and `awk`.
- Plugin installation uses Claude Code's built-in `/install-plugin` — this skill audits and reports, but cannot install plugins programmatically.
- Always use `jq` to merge settings. Never overwrite the full file — the user may have custom env vars, auth tokens, or other plugins.
