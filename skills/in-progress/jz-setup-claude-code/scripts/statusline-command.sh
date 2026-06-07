#!/usr/bin/env bash
# Status line script for Claude Code — two lines:
#   Line 1: branch | last commit | pushed time
#   Line 2: model | effort | context bar | cost | duration
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
