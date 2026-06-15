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

### Step 2 — Ensure `jq` and `git` are reachable from `bash`

The statusline runs as `bash ~/.claude/statusline-command.sh`. Its dependencies:

| Dep | Role | Severity if missing |
|---|---|---|
| `jq` | Parses every field of Claude Code's session JSON | **Critical — blanks the whole status line** (each call prints `jq: command not found` to stderr, exits 0, renders nothing) |
| `git` | Builds all of Line 1 (branch, commit, push time) | **Critical for Line 1** — Line 2 still renders |
| `awk` | Formats token counts as `k`/`M` | Cosmetic — degrades formatting only |

> **⚠️ Key lesson (this silently broke a session):** "the package manager reports jq installed" is NOT sufficient. `jq` must resolve on the PATH that **bash** sees. On Windows, `winget install jqlang.jq` drops `jq.exe` into a WinGet package folder whose shim is not on Git Bash's PATH — so the script renders nothing with no visible error. Always verify reachability *from bash*, never just trust a successful installer.

**Detect the OS:**

```bash
case "$(uname -s)" in
  Darwin*)              os="macos" ;;
  Linux*)               os="linux" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows-gitbash" ;;
  *)                    os="unknown" ;;
esac
```

**Verify each dependency resolves from bash** (record ✅ / ❌):

| Dependency | Check |
|---|---|
| `jq` | `bash -lc 'command -v jq >/dev/null && jq --version'` |
| `git` | `bash -lc 'command -v git >/dev/null && git --version'` |
| `awk` | `bash -lc 'command -v awk >/dev/null && awk --version'` |

**If `jq` is missing or unreachable from bash** (and mode is NOT audit-only), install per OS:

- **macOS** → `brew install jq`
- **Debian/Ubuntu** → `sudo apt install -y jq`
- **Fedora** → `sudo dnf install -y jq`
- **Windows (Git Bash)** → `winget install --id jqlang.jq --accept-source-agreements --accept-package-agreements`, then **shim `jq.exe` onto the Git Bash PATH** (winget will NOT do this for you):

  ```bash
  # Locate the real binary winget installed and copy it into ~/bin
  mkdir -p ~/bin
  JQ_SRC="$(find "$(cygpath -u "$LOCALAPPDATA")/Microsoft/WinGet/Packages" -iname 'jq.exe' 2>/dev/null | head -1)"
  [ -n "$JQ_SRC" ] && cp "$JQ_SRC" ~/bin/jq.exe
  # Ensure ~/bin is on bash's PATH (idempotent)
  grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
  ```

**If `git` is missing:** on Windows install *Git for Windows* (which also provides Git Bash + `git`); on macOS `brew install git`; on Linux `sudo apt/dnf install -y git`.

**`awk`** is virtually always present (`gawk`/`mawk` on Linux, preinstalled on macOS, shipped with Git Bash). Only act if the check fails.

**MANDATORY re-verification after any install** — re-run the bash reachability check above. A zero-exit installer does NOT prove bash can see `jq`. If `bash -lc 'command -v jq'` still returns nothing, the shim did not land on PATH — fix it before continuing. Do not proceed to Step 3 until `jq` resolves from bash.

### Step 3 — Set Up & Validate the Statusline

Skip this step if running audit-only. Requires `jq` reachable from bash (Step 2).

1. Read `scripts/statusline-command.sh` from this skill's directory.
2. Write its content **verbatim** to `~/.claude/statusline-command.sh` using the Write tool. Do not "fix" or reformat it — the script is already portable (see Notes).
3. Make it executable: `chmod +x ~/.claude/statusline-command.sh`
4. Safely **merge** the `statusLine` key into `~/.claude/settings.json` using `jq` — never overwrite the whole file (the user may have custom env vars, tokens, or plugin keys):

   ```bash
   jq '.statusLine = {"type": "command", "command": "bash ~/.claude/statusline-command.sh"}' ~/.claude/settings.json > /tmp/settings-tmp.json && mv /tmp/settings-tmp.json ~/.claude/settings.json
   ```

5. **Validate end-to-end** by piping representative JSON through the script and asserting real output. Run it from inside a git working tree (e.g. the current project) so Line 1 renders too:

   ```bash
   echo '{"model":{"display_name":"Opus 4.8"},"workspace":{"current_dir":"'"$PWD"'"}}' \
     | bash ~/.claude/statusline-command.sh
   ```

   Interpret the result:

   | Output | Meaning | Action |
   |---|---|---|
   | **2 non-empty ANSI-colored lines** | ✅ Working | Done |
   | **0 lines**, or any line containing `jq: command not found` | ❌ `jq` is NOT reachable from bash despite being "installed" | Return to Step 2 (Windows shim / OS install), then re-validate. **Do not report success.** |
   | **1 line only** | Not run from a git repo, or `git` missing | Acceptable only if confirmed not-a-repo; otherwise fix `git` (Step 2) |

   This validation is the real proof of success — a green dependency check or a successful installer message is not.

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
  ✅ Validate — sample JSON rendered 2 lines

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

- **`jq` must resolve from `bash`, not merely be "installed".** On Windows, `winget` installs `jq.exe` but does not put it on Git Bash's PATH — shim it into `~/bin` (Step 2) or the status line renders blank with no visible error. Always confirm via the end-to-end validation in Step 3.
- The statusline script is self-contained and depends only on `jq` (critical), `git` (Line 1), and `awk` (cosmetic formatting). It is portable as-is — do not edit it during setup (the Windows `cygpath` block is guarded and a no-op on macOS/Linux; `date +%s` has no GNU/BSD quirks).
- This skill does NOT configure environment variables (API keys, model mappings, base URLs). Those are user-specific — set them manually in `~/.claude/settings.json`.
- Plugin installation uses Claude Code's built-in `/install-plugin` — this skill audits and reports, but cannot install plugins programmatically.
- Always use `jq` to merge settings. Never overwrite the full file — the user may have custom env vars, auth tokens, or other plugins.
