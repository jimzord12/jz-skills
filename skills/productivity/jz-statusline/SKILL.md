---
name: jz-statusline
description: Install a two-line Claude Code status line showing git branch, dirty state, last commit and push time on line 1, and model, reasoning effort, a context-window bar, 5h/7d rate limits and session duration on line 2. Use when someone asks to set up, install, share or fix this status line, mentions "jz statusline", or points at this skill's GitHub URL and asks for the same status line as a teammate.
metadata:
  version: 0.1.0
  author: jimzord12
  created_at: Sep 2, 2026
  updated_at: Sep 2, 2026
---

# jz-statusline

A two-line Claude Code status line.

```
main │ +2 ~1 ?3 │ fix: stop the statusline dropping segments │ pushed 4 minutes ago
Opus 5 (1M context) │ 🧠 high │ [███░░░░░░░░░░░░░░░░░] 183k/1M (18%) │ 5h 12% (1h29m) │ 7d 88% (3d) │ 15m5s
```

## Sharing this

Nothing needs to be installed from a marketplace. Send a colleague this URL and let their Claude Code read it:

> Set up the status line described at
> `https://github.com/jimzord12/jz-skills/tree/main/skills/productivity/jz-statusline`

Their Claude Code fetches this file, follows the steps below, and writes the status line into *their* config. The only thing that lands on their disk is the one script in Step 3.

**If you are the agent reading this from the web:** you have no local copy of this skill, so do not try to read its files from disk. Fetch the script with the `curl` command in Step 3 and follow the steps in order.

## Requirements

| Dep | Role | Severity if missing |
|---|---|---|
| `jq` | Parses every field of Claude Code's session JSON | **Critical — blanks the whole status line.** The script prints `jq: command not found` to stderr, exits 0, and renders nothing |
| `git` | Builds all of line 1 | **Critical for line 1** — line 2 still renders |
| `curl` | Fetches the script once, during setup | Critical for setup only |

`bash` 4+ is required (`mapfile`, `${var,,}`). macOS ships bash 3.2 as `/bin/bash`, but the script's `#!/usr/bin/env bash` picks up a newer Homebrew bash if one is installed, and Claude Code invokes it via `bash`, so check `bash --version` if line 2 comes out empty on macOS.

## Procedure

### Step 1 — Resolve the config directory

**Do this first.** Claude Code reads its config from `$CLAUDE_CONFIG_DIR` when that variable is set, and only falls back to `~/.claude` when it isn't. Writing to `~/.claude` on a machine that sets `CLAUDE_CONFIG_DIR` puts the status line somewhere Claude Code never reads — every check still passes and the status line simply never appears.

```bash
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# On Windows the variable holds a backslash path (C:\Users\me\.claude-work).
CFG=$(cygpath -u "$CFG" 2>/dev/null || echo "$CFG")
SETTINGS="$CFG/settings.json"
SL="$CFG/statusline-command.sh"
mkdir -p "$CFG"
echo "Config dir: $CFG"
```

Report that path to the user at the end. If it isn't the one they expected, that is the finding.

### Step 2 — Make sure `jq` resolves *from bash*

> **⚠️ The failure that wastes an afternoon:** "the package manager says jq is installed" is not sufficient. `jq` must resolve on the PATH that **bash** sees. On Windows, `winget install jqlang.jq` drops `jq.exe` into a WinGet package folder whose shim is not on Git Bash's PATH — so the status line renders nothing, with no error anywhere.

```bash
bash -lc 'command -v jq  >/dev/null && jq --version'
bash -lc 'command -v git >/dev/null && git --version'
```

Test `awk`-style tools with `command -v` only — never `--version`. macOS ships BSD utilities that lack the flag and exit non-zero, which reads as a missing dependency on the one platform where they are guaranteed present.

If `jq` is missing:

- **macOS** → `brew install jq`
- **Debian/Ubuntu** → `sudo apt install -y jq`
- **Fedora** → `sudo dnf install -y jq`
- **Windows (Git Bash)** → `winget install --id jqlang.jq --accept-source-agreements --accept-package-agreements`, then shim it onto the Git Bash PATH, because winget will not:

  ```bash
  mkdir -p ~/bin
  JQ_SRC="$(find "$(cygpath -u "$LOCALAPPDATA")/Microsoft/WinGet/Packages" -iname 'jq.exe' 2>/dev/null | head -1)"
  [ -n "$JQ_SRC" ] && cp "$JQ_SRC" ~/bin/jq.exe
  grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
  ```

**Re-run the check after installing.** A zero-exit installer does not prove bash can see `jq`. Do not continue until `bash -lc 'command -v jq'` prints a path.

### Step 3 — Fetch the script

Download it rather than retyping it — the script is ~300 lines and a transcription slip is silent.

```bash
curl -fsSL -o "$SL" \
  https://raw.githubusercontent.com/jimzord12/jz-skills/main/skills/productivity/jz-statusline/scripts/statusline-command.sh
```

To pin a known release instead of tracking `main`, swap `main` for a tag such as `v0.4.0`.

Verify the download before wiring it up — `curl -f` catches an HTTP error, but not a proxy that returns a login page with status 200:

```bash
head -1 "$SL" | grep -q '^#!/usr/bin/env bash' && grep -q 'LINE 2: model' "$SL" \
  && echo "✅ script looks intact ($(wc -l < "$SL") lines)" \
  || echo "❌ download is not the expected script — do not continue"
```

### Step 4 — Wire it into settings, then assert it landed

Merge the key; never overwrite the file, which holds the user's env vars, model pins and plugin state.

```bash
# jq cannot read a missing file and emits nothing for an empty one, so the
# naive `jq … > tmp && mv` either writes nothing or installs an empty
# settings.json. Seed it first.
[ -s "$SETTINGS" ] || echo '{}' > "$SETTINGS"

# Prefer a ~-relative command so the settings file stays portable.
case "$SL" in "$HOME"/*) SL_CMD="bash ~${SL#$HOME}" ;; *) SL_CMD="bash $SL" ;; esac

tmp="$SETTINGS.tmp.$$"   # beside the target, not /tmp
jq --arg cmd "$SL_CMD" '.statusLine = {"type":"command","command":$cmd}' "$SETTINGS" > "$tmp" \
  && mv "$tmp" "$SETTINGS" \
  || { rm -f "$tmp"; echo "❌ merge failed — $SETTINGS left untouched"; }

jq -e --arg cmd "$SL_CMD" '.statusLine.command == $cmd' "$SETTINGS" >/dev/null \
  && echo "✅ statusLine wired in $SETTINGS" \
  || echo "❌ statusLine NOT written to $SETTINGS"
```

### Step 5 — Validate the render

Run from inside a git working tree so line 1 renders too:

```bash
echo '{"model":{"display_name":"Opus 5"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"total_input_tokens":50000,"context_window_size":200000},"cost":{"total_duration_ms":45000}}' \
  | bash "$SL"
```

| Output | Meaning | Action |
|---|---|---|
| **2 non-empty coloured lines** | ✅ Working | Done |
| **0 lines**, or `jq: command not found` | ❌ `jq` is not reachable from bash despite being "installed" | Back to Step 2, then re-validate. **Do not report success** |
| **1 line only** | Not run from a git repo, or `git` is missing | Fine if genuinely not a repo; otherwise fix `git` |

Steps 4 and 5 prove different things and neither substitutes for the other: 5 proves the script runs, 4 proves Claude Code will run it. Both must pass.

### Step 6 — Report

State the resolved config dir, the dependency versions, both assertions, and that **the status line appears in the next session** — settings are read at startup, not hot-reloaded.

## Customising

- **Cap the context bar** at a smaller window: set `MAX_CONTEXT_WINDOW` near the top of the script to a token count. `0` uses whatever the model reports.
- **Relative times going stale.** Line 1 shows "pushed 4 minutes ago", which only updates when the status line re-runs — and that is event-driven, so it freezes while the session is idle. To refresh on a timer, add `"refreshInterval": 60` inside the `statusLine` object in `settings.json`.
- **Colours** are plain ANSI constants at the top of the script; the context bar's thresholds are the `ctx_used` comparisons.

## Notes for anyone editing the script

The status line re-runs on every assistant message, and on Windows process creation dominates its cost — a naive version of this script spent about a second per render. It is written to spawn as few processes as possible:

- **One `jq` pass** for the whole payload, read with `mapfile`, one field per line. Do not add a second `jq` call for a new field; add it to the existing array and to the positional assignments below it. The trailing `"."` sentinel in that array is load-bearing: command substitution strips trailing newlines, so without it an absent last field would disappear rather than read as empty.
- **`git -C`, not `cd` in a subshell**, and one `git status --porcelain=v1 -b` for branch, upstream and dirty state together.
- **Pure-bash formatting** instead of `awk` and `cygpath`.

A `$(…)` in the render path is a fork. They add up.
