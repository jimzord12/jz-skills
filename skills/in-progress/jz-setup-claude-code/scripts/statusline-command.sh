#!/usr/bin/env bash
# Status line script for Claude Code — two lines:
#   Line 1: branch | dirty state | last commit | pushed time
#   Line 2: model | effort | context bar | 5h limit | weekly limit | duration
# Receives JSON input via stdin from Claude Code.

input=$(cat)

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

# ── Current working directory ──
cwd=$(echo "$input" | jq -r '.workspace.current_dir // empty')
# On Windows (Git Bash/MSYS), Claude Code sends a backslash path like
# C:\Users\name — `cd` can't handle that, so convert it to POSIX form.
if [ -n "$cwd" ] && command -v cygpath >/dev/null 2>&1; then
  cwd=$(cygpath -u "$cwd" 2>/dev/null || echo "$cwd")
fi

# ═══════════════════════════════════════════════════════════════
# LINE 1: branch | last commit | pushed time
# ═══════════════════════════════════════════════════════════════
line1_parts=()
if [ -n "$cwd" ]; then
  git_dir=$(cd "$cwd" 2>/dev/null && git rev-parse --git-dir 2>/dev/null)
  if [ -n "$git_dir" ]; then
    # Branch name
    branch=$(cd "$cwd" 2>/dev/null && { git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null; })
    if [ -n "$branch" ]; then
      line1_parts+=("${cyan}${branch}${reset}")
    fi

    # Dirty state: +N staged | ~N modified | ?N untracked | ✓ clean
    status=$(cd "$cwd" 2>/dev/null && git status --porcelain 2>/dev/null)
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
    done <<< "$status"
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
    last_msg=$(cd "$cwd" 2>/dev/null && git log -1 --pretty=format:%s 2>/dev/null)
    if [ ${#last_msg} -gt 50 ]; then
      last_msg="${last_msg:0:47}..."
    fi
    if [ -n "$last_msg" ]; then
      line1_parts+=("${white}${last_msg}${reset}")
    fi

    # When the last commit was pushed (relative time)
    # Try @{upstream} first, then fall back to most recent push log
    push_time=""
    push_ref=$(cd "$cwd" 2>/dev/null && git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
    if [ -n "$push_ref" ]; then
      push_time=$(cd "$cwd" 2>/dev/null && git log -1 --pretty=format:%cr "$push_ref" 2>/dev/null)
    fi
    # Fallback: check reflog for the last push action
    if [ -z "$push_time" ]; then
      push_time=$(cd "$cwd" 2>/dev/null && git reflog show --format='%gs %cr' 2>/dev/null | grep -m1 'push' | sed 's/.*: //' | sed 's/ by .*//')
    fi
    # Last resort: time since last commit (local)
    if [ -z "$push_time" ]; then
      push_time=$(cd "$cwd" 2>/dev/null && git log -1 --pretty=format:%cr HEAD 2>/dev/null)
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

# ── Model name ──
model=$(echo "$input" | jq -r '.model.display_name // .model.id // empty')
model=$(echo "$model" | sed 's/\[1m\]/[1m]/g')

# ── Reasoning effort level ──
# Orange = ANSI 38;5;208, Purple = ANSI 38;5;129
orange='\e[38;5;208m'
purple='\e[38;5;129m'
effort=$(echo "$input" | jq -r '.effort.level // empty')
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
ctx_input=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
ctx_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
ctx_segment=""
if [ -n "$ctx_input" ]; then
  effective_max=$MAX_CONTEXT_WINDOW
  if [ -z "$effective_max" ] || [ "$effective_max" -le 0 ] 2>/dev/null; then
    effective_max=$ctx_window_size
  fi

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

  ctx_input_fmt=$(echo "$ctx_input" | awk '{if($1>=1000) printf "%.0fk", $1/1000; else print $1}')
  ctx_max_fmt=$(echo "$effective_max" | awk '{if($1>=1000000) printf "%.0fM", $1/1000000; else if($1>=1000) printf "%.0fk", $1/1000; else print $1}')

  ctx_segment="${dim}[${reset}${ctx_color}${bar}${reset}${dim}]${reset} ${ctx_color}${ctx_input_fmt}${reset}${dim}/${ctx_max_fmt}${reset} ${ctx_color}(${ctx_used}%)${reset}"
fi

# ── Session duration ──
duration=$(echo "$input" | jq -r '.cost.total_duration_ms // empty')
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
# Helper: color a percentage (0-49 green, 50-79 yellow, 80+ red)
rl_color() {
  local p=$1
  if [ "$p" -ge 80 ]; then echo "$red"
  elif [ "$p" -ge 50 ]; then echo "$yellow"
  else echo "$green"; fi
}
# Helper: format seconds-until-reset as a compact relative string
rl_reset_fmt() {
  local resets_at=$1
  local now rem
  now=$(date +%s)
  rem=$((resets_at - now))
  [ "$rem" -le 0 ] && { echo "now"; return; }
  if [ "$rem" -ge 86400 ]; then
    echo "$((rem / 86400))d"
  elif [ "$rem" -ge 3600 ]; then
    echo "$((rem / 3600))h$(((rem % 3600) / 60))m"
  elif [ "$rem" -ge 60 ]; then
    echo "$((rem / 60))m"
  else
    echo "${rem}s"
  fi
}

build_rl_segment() {
  local label=$1 pct_raw=$2 resets_at=$3
  [ -z "$pct_raw" ] && return
  local pct color reset_str=""
  pct=$(printf '%.0f' "$pct_raw" 2>/dev/null) || return
  color=$(rl_color "$pct")
  if [ -n "$resets_at" ]; then
    reset_str=" ${dim}($(rl_reset_fmt "$resets_at"))${reset}"
  fi
  echo "${dim}${label}${reset} ${color}${pct}%${reset}${reset_str}"
}

rl_five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
rl_five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
rl_seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
rl_seven_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

rl_five_segment=$(build_rl_segment "5h" "$rl_five_pct" "$rl_five_reset")
rl_seven_segment=$(build_rl_segment "7d" "$rl_seven_pct" "$rl_seven_reset")

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
