---
name: jz-setup-claude-code
description: Set up or audit jimzord12's personal Claude Code environment — the statusline plus a specific 11-plugin manifest and marketplace source. Use when setting up a new machine, auditing an existing installation, or checking which of the expected plugins are missing. Also use when the user mentions "fresh install", "new machine setup", "check my plugins", "verify my setup", or "what am I missing".
argument-hint: 'Optionally specify "statusline-only" to set up just the statusline, or "audit-only" to skip installation and only report status.'
metadata:
  version: 0.2.0
  author: jimzord12
  created_at: Jun 7, 2026
  updated_at: Sep 2, 2026
---

# jz-setup-claude-code

> **This skill is personal, not shareable.** The plugin manifest below is one
> developer's setup; following it on someone else's machine installs eleven
> plugins they did not ask for. To share only the status line, point people at
> [`jz-statusline`](../../productivity/jz-statusline/SKILL.md) instead — it is
> self-contained and safe to follow from a URL.

Brings a machine up to the full personal setup: status line, plugins, marketplace sources, and the dependencies they need. Can also run in audit-only mode to report what's installed vs missing.

## When to Use

- Fresh Claude Code installation that needs the full setup
- Auditing an existing installation for completeness
- After a settings reset or migration to a new machine

## Procedure

### Step 1 — Resolve the config directory and parse arguments

Claude Code reads its config from `$CLAUDE_CONFIG_DIR` when set, falling back to `~/.claude` only when it isn't. Resolve it once and report it — a surprising path here explains most "my setting didn't apply" confusion.

```bash
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CFG=$(cygpath -u "$CFG" 2>/dev/null || echo "$CFG")   # Windows stores a backslash path
echo "Config dir: $CFG"
```

Then check the argument hint:

- `"statusline-only"` → do Step 2 only
- `"audit-only"` → skip all installation, only report status
- No argument or anything else → run the full setup + audit

### Step 2 — Status line

Follow the **`jz-statusline`** skill, which owns the script, the `jq`-reachability checks, the settings merge and the validation. It lives at `skills/productivity/jz-statusline/` in this repo, or at:

```
https://github.com/jimzord12/jz-skills/tree/main/skills/productivity/jz-statusline
```

Do not duplicate its steps here. Report its result as this skill's "Statusline" section.

### Step 3 — Plugins & marketplace

Read `references/expected-plugins.md` for the manifest. Use the `claude plugin` CLI rather than parsing `settings.json` by hand: `enabledPlugins` can also arrive from a project's `.claude/settings.json`, from `--add-dir` directories, and from managed settings, so a single-file read will misreport.

**Audit** (all modes):

```bash
claude plugin marketplace list
claude plugin list --json
```

Compare against the 11 manifest entries:

- Present and enabled → ✅ installed and enabled
- Present and disabled → ⚠️ installed but disabled
- Absent → ❌ not installed

**Install** (skip if audit-only). Confirm with the user first — this is the step that must never run on someone else's machine:

```bash
# The context-mode marketplace is not registered by default
claude plugin marketplace add mksglu/context-mode

# One per missing plugin
claude plugin install <name>@claude-plugins-official -y
claude plugin install context-mode@context-mode -y

# For any plugin present but disabled
claude plugin enable <name>
```

Re-run `claude plugin list --json` afterwards and report the post-install state.

### Step 4 — Report

```
╭─────────────────────────────────────────────╮
│  Claude Code Environment Status              │
╰─────────────────────────────────────────────╯

Config dir
  ~/.claude-work  (from $CLAUDE_CONFIG_DIR)

Statusline
  ✅ Configured via jz-statusline (takes effect next session)

Plugins (11/11)
  ✅ frontend-design       ✅ superpowers
  ✅ context7              ✅ skill-creator
  ✅ code-simplifier       ✅ playwright
  ✅ claude-md-management  ✅ typescript-lsp
  ✅ ralph-loop            ✅ claude-code-setup
  ✅ context-mode

Marketplace Sources
  ✅ claude-plugins-official — anthropics/claude-plugins-official
  ✅ context-mode            — mksglu/context-mode

🎉 All 11 plugins installed, statusline configured.
```

Adapt to what was actually found. If there are issues:

```
❌ 2 missing · ⚠️ 1 disabled

To fix:
  claude plugin install ralph-loop@claude-plugins-official -y
  claude plugin marketplace add mksglu/context-mode
  claude plugin install context-mode@context-mode -y
  claude plugin enable code-simplifier
```

## Important Notes

- **Resolve `$CLAUDE_CONFIG_DIR` first.** Hardcoding `~/.claude` writes perfectly good config into a directory Claude Code isn't reading, and every check still reports ✅.
- Plugin installation is scriptable via `claude plugin install/enable` and `claude plugin marketplace add` (non-interactive with `-y`). The in-app equivalents are `/plugin install <name>@<marketplace>` and the `/plugin` browser. There is no `/install-plugin` command.
- This skill does NOT configure environment variables (API keys, model mappings, base URLs). Those are user-specific — set them manually in the resolved `settings.json`.
- Always use `jq` to merge settings. Never overwrite the full file — it holds env vars, auth tokens, and plugin state.
