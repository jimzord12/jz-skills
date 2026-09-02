---
name: jz-setup-claude-code
description: Initialize or audit a Claude Code installation. Use when setting up a new Claude Code environment, auditing an existing installation, or verifying that all plugins, skills, marketplace sources, statusline, and dependencies are correctly installed and configured. Also use when the user mentions "fresh install", "new machine setup", "check my plugins", "verify my setup", or "what am I missing".
argument-hint: 'Optionally specify "statusline-only" to set up just the statusline, or "audit-only" to skip installation and only report status.'
metadata:
  version: 0.1.0
  author: jimzord12
  created_at: Jun 7, 2026
  updated_at: Sep 2, 2026
---

# jz-setup-claude-code

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
| `scripts/statusline-command.sh` | The two-line statusline rendering script — copy directly into the config dir resolved in Step 1 |
| `references/expected-plugins.md` | Full plugin manifest (11 plugins) + marketplace source — read this during the audit step |

## Procedure

### Step 1 — Resolve the config directory, then parse arguments

**Do this before touching anything.** Claude Code reads its config from `$CLAUDE_CONFIG_DIR` when that variable is set, and only falls back to `~/.claude` when it isn't. Writing to `~/.claude` on a machine that sets `CLAUDE_CONFIG_DIR` puts the statusline in a directory Claude Code never reads — every check downstream still passes, and the statusline simply never appears. Resolve it once:

```bash
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# On Windows the variable holds a backslash path (C:\Users\me\.claude-work);
# bash needs the POSIX form.
CFG=$(cygpath -u "$CFG" 2>/dev/null || echo "$CFG")
SETTINGS="$CFG/settings.json"
SL="$CFG/statusline-command.sh"
mkdir -p "$CFG"
echo "Config dir: $CFG"
```

Every path below is written as `$CFG/...`. **Never hardcode `~/.claude`.** Report the resolved path to the user in Step 5 — if it isn't the one they expected, that is the finding.

Then check the argument hint:

- `"statusline-only"` → skip plugin/marketplace checks, only set up the statusline
- `"audit-only"` → skip all installation, only report current status
- No argument or anything else → run the full setup + audit

### Step 2 — Ensure `jq` and `git` are reachable from `bash`

The statusline runs as `bash <config dir>/statusline-command.sh`. Its dependencies:

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

```bash
bash -lc 'command -v jq  >/dev/null && jq --version'
bash -lc 'command -v git >/dev/null && git --version'
bash -lc 'command -v awk >/dev/null && echo "awk present"'
```

Test `awk` with `command -v` only. macOS ships BSD awk, which has no `--version` flag and exits non-zero — `awk --version` reports a missing dependency on the one platform where awk is guaranteed to be present.

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

Skip this step if running audit-only. Requires `jq` reachable from bash (Step 2) and `$CFG` from Step 1.

1. Read `scripts/statusline-command.sh` from this skill's directory.
2. Write its content **verbatim** to `$SL` using the Write tool. Do not "fix" or reformat it — the script is already portable (see Notes).
3. Safely **merge** the `statusLine` key into `$SETTINGS` — never overwrite the whole file (the user may have custom env vars, tokens, or plugin keys):

   ```bash
   # jq cannot read a file that does not exist, and emits nothing for an empty
   # one — either way the naive `jq … > tmp && mv` leaves you with no settings
   # and no error. Seed the file first.
   [ -s "$SETTINGS" ] || echo '{}' > "$SETTINGS"

   # Prefer a ~-relative command so the settings file stays portable.
   case "$SL" in "$HOME"/*) SL_CMD="bash ~${SL#$HOME}" ;; *) SL_CMD="bash $SL" ;; esac

   tmp="$SETTINGS.tmp.$$"   # beside the target, not /tmp — no cross-run collisions
   jq --arg cmd "$SL_CMD" '.statusLine = {"type":"command","command":$cmd}' "$SETTINGS" > "$tmp" \
     && mv "$tmp" "$SETTINGS" \
     || { rm -f "$tmp"; echo "❌ merge failed — $SETTINGS left untouched"; }
   ```

4. **Assert the settings write actually landed.** This is the check that catches a wrong config dir or a silently failed merge:

   ```bash
   jq -e --arg cmd "$SL_CMD" '.statusLine.command == $cmd' "$SETTINGS" >/dev/null \
     && echo "✅ statusLine wired in $SETTINGS" \
     || echo "❌ statusLine NOT written to $SETTINGS"
   ```

5. **Validate the script end-to-end** by piping representative JSON through it and asserting real output. Run it from inside a git working tree (e.g. the current project) so Line 1 renders too:

   ```bash
   echo '{"model":{"display_name":"Opus 5"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"total_input_tokens":50000,"context_window_size":200000}}' \
     | bash "$SL"
   ```

   Interpret the result:

   | Output | Meaning | Action |
   |---|---|---|
   | **2 non-empty ANSI-colored lines** | ✅ Working | Done |
   | **0 lines**, or any line containing `jq: command not found` | ❌ `jq` is NOT reachable from bash despite being "installed" | Return to Step 2 (Windows shim / OS install), then re-validate. **Do not report success.** |
   | **1 line only** | Not run from a git repo, or `git` missing | Acceptable only if confirmed not-a-repo; otherwise fix `git` (Step 2) |

   Steps 4 and 5 prove different things and neither substitutes for the other: 5 proves the *script* runs, 4 proves *Claude Code will run it*. Both must pass.

6. Tell the user the statusline appears in the **next** session — it is read at startup, not hot-reloaded.

### Step 4 — Plugins & Marketplace

Read `references/expected-plugins.md` for the full manifest. Use the `claude plugin` CLI rather than parsing `settings.json` by hand: `enabledPlugins` can also arrive from a project's `.claude/settings.json`, from `--add-dir` directories, and from managed settings, so a single-file read will misreport.

**Audit** (all modes):

```bash
claude plugin marketplace list
claude plugin list --json
```

Compare `claude plugin list --json` against the 11 manifest entries:

- Present and enabled → ✅ installed and enabled
- Present and disabled → ⚠️ installed but disabled
- Absent → ❌ not installed

**Install** (skip if audit-only). Ask the user before installing, then run — these are non-interactive and safe to script:

```bash
# The context-mode marketplace is not registered by default
claude plugin marketplace add mksglu/context-mode

# One per missing plugin; official plugins need no @marketplace suffix
claude plugin install <name>@claude-plugins-official -y
claude plugin install context-mode@context-mode -y

# For any plugin present but disabled
claude plugin enable <name>
```

Re-run `claude plugin list --json` afterwards and report the post-install state, not the pre-install one.

### Step 5 — Report

Output a clean status report. Always name the resolved config dir — a surprising path there is the single most useful line in the report.

```
╭─────────────────────────────────────────────╮
│  Claude Code Environment Status              │
╰─────────────────────────────────────────────╯

Config dir
  ~/.claude-work  (from $CLAUDE_CONFIG_DIR)

Dependencies
  ✅ jq   — 1.7.1
  ✅ git  — 2.47.1
  ✅ awk  — present

Statusline
  ✅ Script   — ~/.claude-work/statusline-command.sh
  ✅ Settings — statusLine key asserted in settings.json
  ✅ Validate — sample JSON rendered 2 lines
  ℹ️  Takes effect in the next session

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

🎉 All 11 plugins installed, statusline configured, dependencies met.
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

- **Resolve `$CLAUDE_CONFIG_DIR` first (Step 1).** Hardcoding `~/.claude` is the failure this skill is most likely to hit: it writes a perfectly good statusline into a directory Claude Code isn't reading, and every check still reports ✅.
- **`jq` must resolve from `bash`, not merely be "installed".** On Windows, `winget` installs `jq.exe` but does not put it on Git Bash's PATH — shim it into `~/bin` (Step 2) or the status line renders blank with no visible error.
- **Assert, don't assume.** A successful installer, a green dependency check, and a script that renders when piped JSON are each necessary and none is sufficient. The settings assertion in Step 3.4 is what proves the wiring.
- The statusline script is self-contained and depends only on `jq` (critical), `git` (Line 1), and `awk` (cosmetic formatting). It is portable as-is — do not edit it during setup (the Windows `cygpath` block is guarded and a no-op on macOS/Linux).
- Plugin installation is scriptable via `claude plugin install/enable` and `claude plugin marketplace add` (all non-interactive with `-y`). The in-app equivalents are `/plugin install <name>@<marketplace>` and the `/plugin` browser. There is no `/install-plugin` command.
- This skill does NOT configure environment variables (API keys, model mappings, base URLs). Those are user-specific — set them manually in the resolved `settings.json`.
- Always use `jq` to merge settings. Never overwrite the full file — the user may have custom env vars, auth tokens, or other plugins.
