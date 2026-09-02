#!/usr/bin/env bash
# Status line script for Claude Code — two lines:
#   Line 1: branch | dirty state | last commit | pushed time
#   Line 2: model | effort | context bar | 5h limit | weekly limit | duration
# Receives JSON input via stdin from Claude Code.
#
# Performance note: this script re-runs on every assistant message, and on
# Windows process creation dominates its cost. So it spawns as few processes
# as it can — one `jq` pass for the whole payload, `git -C` instead of
# `cd`-in-a-subshell, one `git status -b` for branch + upstream + dirty state,
# and pure-bash formatting in place of `awk` and `cygpath`. Keep it that way:
# a `$(…)` inside the render path is a fork, and they add up fast.

# `input=$(cat)` would fork a subshell and exec cat; this reads stdin whole
# using only builtins. There is no NUL in the payload, so read hits EOF and
# returns non-zero with the content already stored.
IFS= read -r -d '' input || :

# ── Config ──
MAX_CONTEXT_WINDOW=0  # Cap context window (tokens). 0 = use model default.

# --- ANSI helpers ---
reset='\e[0m'
bold='\e[1m'
dim='\e[2m'
red='\e[31m'
green='\e[32m'
yellow='\e[33m'
blue='\e[34m'
magenta='\e[35m'
cyan='\e[36m'
white='\e[37m'
sep=" ${dim}│${reset} "

# ══════════════════════════════════════════════════════════════
# Parse the whole payload in a single jq pass
# ══════════════════════════════════════════════════════════════
# Ten separate `jq -r` calls were ten process spawns per render.
#
# One field per line, read with mapfile: no exotic separator, and no risk of
# bash collapsing empty fields the way it would with a tab-based IFS split.
# The trailing "." is a sentinel — command substitution strips trailing
# newlines, so without it an absent last field would vanish instead of
# reading as empty.
mapfile -t _f <<FIELDS
$(printf '%s' "$input" | jq -r '[
    (.workspace.current_dir // ""),
    (.model.display_name // .model.id // ""),
    (.effort.level // ""),
    (.context_window.total_input_tokens // "" | tostring),
    (.context_window.context_window_size // "" | tostring),
    (.cost.total_duration_ms // "" | tostring),
    (.rate_limits.five_hour.used_percentage // "" | tostring),
    (.rate_limits.five_hour.resets_at // "" | tostring),
    (.rate_limits.seven_day.used_percentage // "" | tostring),
    (.rate_limits.seven_day.resets_at // "" | tostring),
    "."
  ] | .[]' 2>/dev/null)
FIELDS

# jq's Windows build writes stdout in text mode, so every line arrives as
# CRLF. `$(…)` strips a trailing CRLF whole, which is why the one-jq-call-per
# -field version never saw this — but mapfile strips only the newline and
# leaves the CR attached to every value, where it defeats -n tests and breaks
# arithmetic. Drop it here; a no-op everywhere except Windows.
for _i in "${!_f[@]}"; do _f[_i]=${_f[_i]%$'\r'}; done

cwd=${_f[0]-}
model=${_f[1]-}
effort=${_f[2]-}
ctx_input=${_f[3]-}
ctx_window_size=${_f[4]-}
duration=${_f[5]-}
rl_five_pct=${_f[6]-}
rl_five_reset=${_f[7]-}
rl_seven_pct=${_f[8]-}
rl_seven_reset=${_f[9]-}

# On Windows (Git Bash/MSYS), Claude Code sends a backslash path like
# C:\Users\name — git wants the POSIX form. Done with parameter expansion
# rather than cygpath, which would cost another process on every render.
case "$cwd" in
  [A-Za-z]:[\\/]*)
    _drive=${cwd%%:*}
    _rest=${cwd#*:}
    cwd="/${_drive,,}${_rest//\\//}"
    ;;
esac

# One clock reading for every relative time below, via printf's %(…)T rather
# than a `date` process.
printf -v now '%(%s)T' -1

# Token-count formatting, replacing two `awk` calls. These set a variable
# instead of echoing: `x=$(f)` is a subshell, and the point here is to fork
# as little as possible.
#
# awk's "%.0f" rounds half to *even* (2500/1000 is "2k", not "3k"), so plain
# (n + d/2) / d truncation would not match. Sets _rd.
_round_div() {
  local n=$1 d=$2 q r
  q=$(( n / d ))
  r=$(( n % d ))
  if [ $(( r * 2 )) -gt "$d" ]; then
    q=$(( q + 1 ))
  elif [ $(( r * 2 )) -eq "$d" ] && [ $(( q % 2 )) -eq 1 ]; then
    q=$(( q + 1 ))   # exact half, odd quotient: round up to the even one
  fi
  _rd=$q
}

# The token count and the window size were formatted by *different* awk
# programs: the count only ever abbreviates to "k" (1500000 renders "1500k"),
# while the window size also uses "M". Keep them separate. Both set _fmt.
fmt_count() {
  local n=$1
  if [ "$n" -ge 1000 ]; then _round_div "$n" 1000; _fmt="${_rd}k"; else _fmt="$n"; fi
}
fmt_size() {
  local n=$1
  if [ "$n" -ge 1000000 ]; then
    _round_div "$n" 1000000; _fmt="${_rd}M"
  elif [ "$n" -ge 1000 ]; then
    _round_div "$n" 1000; _fmt="${_rd}k"
  else
    _fmt="$n"
  fi
}

# ═══════════════════════════════════════════════════════════════
# LINE 1: branch | last commit | pushed time
# ═══════════════════════════════════════════════════════════════
line1_parts=()
if [ -n "$cwd" ]; then
  # `status -b` carries the branch, its upstream and the dirty state in one
  # call — previously four separate git invocations, each in its own subshell.
  # A non-zero exit is the "not a git repo" signal.
  if status=$(git -C "$cwd" status --porcelain=v1 -b 2>/dev/null); then
    hdr=${status%%$'\n'*}
    entries=${status#*$'\n'}
    [ "$entries" = "$status" ] && entries=""   # header only: nothing dirty

    # Branch name, and the upstream ref if the header names one.
    branch=""
    upstream=""
    b=${hdr#\#\# }
    case "$b" in
      'No commits yet on '*)
        branch=${b#No commits yet on }
        ;;
      'HEAD (no branch)')
        branch=$(git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
        ;;
      *)
        case "$b" in
          *...*)
            upstream=${b#*...}
            upstream=${upstream%% *}
            b=${b%%...*}
            ;;
        esac
        branch=$b
        ;;
    esac
    if [ -n "$branch" ]; then
      line1_parts+=("${cyan}${branch}${reset}")
    fi

    # Dirty state: +N staged | ~N modified | ?N untracked | ✓ clean
    staged=0; modified=0; untracked=0
    while IFS= read -r st_line; do
      [ -z "$st_line" ] && continue
      case "$st_line" in
        '??'*) untracked=$((untracked + 1)); continue ;;
      esac
      x=${st_line:0:1}
      y=${st_line:1:1}
      case "$x" in [MADRC]) staged=$((staged + 1)) ;; esac
      case "$y" in [MD]) modified=$((modified + 1)) ;; esac
    done <<< "$entries"
    dirty=""
    [ "$staged" -gt 0 ]    && dirty="${dirty}${green}+${staged}${reset} "
    [ "$modified" -gt 0 ]  && dirty="${dirty}${yellow}~${modified}${reset} "
    [ "$untracked" -gt 0 ] && dirty="${dirty}${dim}?${untracked}${reset} "
    if [ -z "$dirty" ]; then
      dirty="${green}✓${reset}"
    else
      dirty="${dirty% }"  # trim trailing space
    fi
    line1_parts+=("$dirty")

    # Last commit message (truncated to 50 chars)
    last_msg=$(git -C "$cwd" log -1 --pretty=format:%s 2>/dev/null)
    if [ ${#last_msg} -gt 50 ]; then
      last_msg="${last_msg:0:47}..."
    fi
    if [ -n "$last_msg" ]; then
      line1_parts+=("${white}${last_msg}${reset}")
    fi

    # When the last commit was pushed (relative time)
    # Use the upstream from the status header, then the reflog, then HEAD.
    push_time=""
    if [ -n "$upstream" ]; then
      push_time=$(git -C "$cwd" log -1 --pretty=format:%cr "$upstream" 2>/dev/null)
    fi
    # Fallback: check reflog for the last push action
    if [ -z "$push_time" ]; then
      push_time=$(git -C "$cwd" reflog show --format='%gs %cr' 2>/dev/null | grep -m1 'push' | sed 's/.*: //' | sed 's/ by .*//')
    fi
    # Last resort: time since last commit (local)
    if [ -z "$push_time" ]; then
      push_time=$(git -C "$cwd" log -1 --pretty=format:%cr HEAD 2>/dev/null)
    fi
    if [ -n "$push_time" ]; then
      line1_parts+=("${dim}pushed ${push_time}${reset}")
    fi
  fi
fi

line1=""
for i in "${!line1_parts[@]}"; do
  if [ "$i" -gt 0 ]; then
    line1="${line1}${sep}"
  fi
  line1="${line1}${line1_parts[$i]}"
done

# ═══════════════════════════════════════════════════════════════
# LINE 2: model | effort | context bar | cost | duration
# ═══════════════════════════════════════════════════════════════

# ── Reasoning effort level ──
# Orange = ANSI 38;5;208, Purple = ANSI 38;5;129
orange='\e[38;5;208m'
purple='\e[38;5;129m'
effort_segment=""
if [ -n "$effort" ]; then
  case "$effort" in
    low)        effort_color="$white" ;;
    medium)     effort_color="$yellow" ;;
    high)       effort_color="$orange" ;;
    xhigh)      effort_color="$red" ;;
    max)        effort_color="$purple" ;;
    ultracode)  effort_color="$purple" ;;
    *)          effort_color="$white" ;;
  esac
  effort_segment="🧠 ${effort_color}${effort}${reset}"
fi

# ── Context window usage (bar UI) ──
ctx_segment=""

# Treat anything non-numeric as absent so the arithmetic below cannot throw.
case "$ctx_input" in ''|*[!0-9]*) ctx_input="" ;; esac
effective_max=$MAX_CONTEXT_WINDOW
case "$effective_max" in ''|*[!0-9]*) effective_max=0 ;; esac
if [ "$effective_max" -le 0 ]; then
  effective_max=$ctx_window_size
fi
# Claude Code does not always send context_window_size. Without a usable
# window there is nothing to divide by, so skip the bar rather than let the
# shell raise "division by 0" and silently drop the whole segment.
case "$effective_max" in ''|*[!0-9]*) effective_max=0 ;; esac

if [ -n "$ctx_input" ] && [ "$effective_max" -gt 0 ]; then
  ctx_used=$((ctx_input * 100 / effective_max))
  if [ "$ctx_used" -gt 100 ]; then
    ctx_used=100
  fi

  # Color thresholds: 0-30% green, 31-45% yellow, 46-60% red, 61-100% dark red
  darkred='\e[38;5;124m'
  if [ "$ctx_used" -le 30 ]; then
    ctx_color="$green"
  elif [ "$ctx_used" -le 45 ]; then
    ctx_color="$yellow"
  elif [ "$ctx_used" -le 60 ]; then
    ctx_color="$red"
  else
    ctx_color="$darkred"
  fi

  bar_width=20
  filled=$((ctx_used * bar_width / 100))
  empty=$((bar_width - filled))

  bar=""
  for ((i=0; i<filled; i++)); do
    bar="${bar}█"
  done
  for ((i=0; i<empty; i++)); do
    bar="${bar}░"
  done

  fmt_count "$ctx_input";     ctx_input_fmt=$_fmt
  fmt_size  "$effective_max"; ctx_max_fmt=$_fmt

  ctx_segment="${dim}[${reset}${ctx_color}${bar}${reset}${dim}]${reset} ${ctx_color}${ctx_input_fmt}${reset}${dim}/${ctx_max_fmt}${reset} ${ctx_color}(${ctx_used}%)${reset}"
fi

# ── Session duration ──
if [ -n "$duration" ]; then
  secs=$((duration / 1000))
  if [ "$secs" -ge 60 ]; then
    mins=$((secs / 60))
    rem_secs=$((secs % 60))
    dur_segment="${dim}${mins}m${rem_secs}s${reset}"
  else
    dur_segment="${dim}${secs}s${reset}"
  fi
else
  dur_segment=""
fi

# ── Rate limits (5-hour + weekly) ──
# These helpers assign to a variable rather than echoing: `x=$(helper)` forks
# a subshell, and the two rate-limit segments together used to cost eight of
# them per render.
#
# Helper: color a percentage (0-49 green, 50-79 yellow, 80+ red). Sets _rlc.
rl_color() {
  local p=$1
  if [ "$p" -ge 80 ]; then _rlc=$red
  elif [ "$p" -ge 50 ]; then _rlc=$yellow
  else _rlc=$green; fi
}
# Helper: format seconds-until-reset as a compact relative string. Sets _rlr,
# left empty when the timestamp cannot be read.
rl_reset_fmt() {
  local resets_at=$1
  local rem target
  # resets_at is documented as epoch seconds; tolerate an ISO-8601 timestamp
  # too, since bare arithmetic on one would abort the whole segment.
  case "$resets_at" in
    ''|*[!0-9]*) target=$(date -d "$resets_at" +%s 2>/dev/null) ;;
    *)           target=$resets_at ;;
  esac
  # Unparseable: leave _rlr empty and the caller omits the suffix entirely.
  _rlr=""
  case "$target" in ''|*[!0-9]*) return ;; esac
  rem=$((target - now))
  [ "$rem" -le 0 ] && { _rlr="now"; return; }
  if [ "$rem" -ge 86400 ]; then
    _rlr="$((rem / 86400))d"
  elif [ "$rem" -ge 3600 ]; then
    _rlr="$((rem / 3600))h$(((rem % 3600) / 60))m"
  elif [ "$rem" -ge 60 ]; then
    _rlr="$((rem / 60))m"
  else
    _rlr="${rem}s"
  fi
}

# Sets _rls to the finished segment, or empty when there is nothing to show.
build_rl_segment() {
  local label=$1 pct_raw=$2 resets_at=$3
  local pct reset_str=""
  _rls=""
  [ -z "$pct_raw" ] && return
  printf -v pct '%.0f' "$pct_raw" 2>/dev/null || return
  case "$pct" in ''|*[!0-9]*) return ;; esac
  rl_color "$pct"
  # Only append the "(2h5m)" suffix when the reset time actually parsed —
  # otherwise the segment renders a bare, meaningless "()".
  _rlr=""
  [ -n "$resets_at" ] && rl_reset_fmt "$resets_at"
  [ -n "$_rlr" ] && reset_str=" ${dim}(${_rlr})${reset}"
  _rls="${dim}${label}${reset} ${_rlc}${pct}%${reset}${reset_str}"
}

build_rl_segment "5h" "$rl_five_pct" "$rl_five_reset";   rl_five_segment=$_rls
build_rl_segment "7d" "$rl_seven_pct" "$rl_seven_reset"; rl_seven_segment=$_rls

# ── Build Line 2 ──
line2_parts=()
if [ -n "$model" ]; then
  line2_parts+=("${yellow}${model}${reset}")
fi
if [ -n "$effort_segment" ]; then
  line2_parts+=("$effort_segment")
fi
if [ -n "$ctx_segment" ]; then
  line2_parts+=("$ctx_segment")
fi
if [ -n "$rl_five_segment" ]; then
  line2_parts+=("$rl_five_segment")
fi
if [ -n "$rl_seven_segment" ]; then
  line2_parts+=("$rl_seven_segment")
fi
if [ -n "$dur_segment" ]; then
  line2_parts+=("$dur_segment")
fi

line2=""
for i in "${!line2_parts[@]}"; do
  if [ "$i" -gt 0 ]; then
    line2="${line2}${sep}"
  fi
  line2="${line2}${line2_parts[$i]}"
done

# ── Output ──
if [ -n "$line1" ]; then
  echo -e "$line1"
fi
if [ -n "$line2" ]; then
  echo -e "$line2"
fi
