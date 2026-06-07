#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
BRANCH="${2:-}"

ROOT="${PWD}"
SKILLS_DIR="${ROOT}/.agents/skills"

failures=()
warnings=()

add_failure() {
  failures+=("$1")
}

add_warning() {
  warnings+=("$1")
}

check_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    add_failure "Missing file: $path"
    return 1
  fi
}

check_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    add_failure "Missing directory: $path"
    return 1
  fi
}

check_executable() {
  local path="$1"
  if [[ ! -x "$path" ]]; then
    add_warning "Script is not executable: $path"
  fi
}

check_frontmatter() {
  local path="$1"
  check_file "$path" || return 1

  local first_line
  first_line="$(head -n 1 "$path" || true)"
  if [[ "$first_line" != "---" ]]; then
    add_failure "Missing YAML frontmatter start in: $path"
    return 1
  fi

  if ! grep -q '^name:' "$path"; then
    add_failure "Missing 'name' in frontmatter: $path"
  fi

  if ! grep -q '^description:' "$path"; then
    add_failure "Missing 'description' in frontmatter: $path"
  fi
}

check_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    add_failure "Missing required tool: $tool"
  fi
}

echo "Verifying local skill installation..."
echo

check_dir "$SKILLS_DIR"
check_dir "$SKILLS_DIR/git-flow-check"
check_dir "$SKILLS_DIR/git-flow-add-restriction"
check_dir "$SKILLS_DIR/verify-git-flow-setup"

check_frontmatter "$SKILLS_DIR/git-flow-check/SKILL.md"
check_frontmatter "$SKILLS_DIR/git-flow-add-restriction/SKILL.md"
check_frontmatter "$SKILLS_DIR/verify-git-flow-setup/SKILL.md"

check_file "$SKILLS_DIR/git-flow-check/scripts/check-git-flow.sh"
check_file "$SKILLS_DIR/git-flow-add-restriction/scripts/add-git-flow-restriction.sh"
check_file "$SKILLS_DIR/verify-git-flow-setup/scripts/verify-git-flow-setup.sh"

check_executable "$SKILLS_DIR/git-flow-check/scripts/check-git-flow.sh"
check_executable "$SKILLS_DIR/git-flow-add-restriction/scripts/add-git-flow-restriction.sh"
check_executable "$SKILLS_DIR/verify-git-flow-setup/scripts/verify-git-flow-setup.sh"

if [[ -f "$SKILLS_DIR/git-flow-check/SKILL.md" ]]; then
  actual_name="$(grep '^name:' "$SKILLS_DIR/git-flow-check/SKILL.md" | head -n1 | sed 's/^name:[[:space:]]*//')"
  [[ "$actual_name" == "git-flow-check" ]] || add_failure "Skill name mismatch in git-flow-check/SKILL.md"
fi

if [[ -f "$SKILLS_DIR/git-flow-add-restriction/SKILL.md" ]]; then
  actual_name="$(grep '^name:' "$SKILLS_DIR/git-flow-add-restriction/SKILL.md" | head -n1 | sed 's/^name:[[:space:]]*//')"
  [[ "$actual_name" == "git-flow-add-restriction" ]] || add_failure "Skill name mismatch in git-flow-add-restriction/SKILL.md"
fi

if [[ -f "$SKILLS_DIR/verify-git-flow-setup/SKILL.md" ]]; then
  actual_name="$(grep '^name:' "$SKILLS_DIR/verify-git-flow-setup/SKILL.md" | head -n1 | sed 's/^name:[[:space:]]*//')"
  [[ "$actual_name" == "verify-git-flow-setup" ]] || add_failure "Skill name mismatch in verify-git-flow-setup/SKILL.md"
fi

check_tool gh
check_tool jq
check_tool git

auth_ok="unknown"
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    auth_ok="yes"
  else
    auth_ok="no"
    add_warning "gh is installed but authentication is not ready"
  fi
fi

repo_status="not_run"
default_branch="unknown"
protection_visible="not_run"
ruleset_visible="not_run"
required_checks_ready="not_run"

if [[ -n "$REPO" ]]; then
  echo "Verifying repository readiness..."
  echo

  repo_status="started"

  if ! command -v gh >/dev/null 2>&1; then
    add_failure "Cannot verify repository without gh"
  elif [[ "$auth_ok" != "yes" ]]; then
    add_failure "Cannot verify repository because gh authentication is not ready"
  else
    if repo_json="$(gh repo view "$REPO" --json nameWithOwner,defaultBranchRef,url 2>/dev/null)"; then
      default_branch="$(jq -r '.defaultBranchRef.name' <<<"$repo_json")"
      audit_branch="${BRANCH:-$default_branch}"
      repo_status="ok"

      if gh api "repos/$REPO/branches/$audit_branch/protection" >/tmp/verify-git-flow-protection.json 2>/dev/null; then
        protection_visible="yes"
      else
        protection_visible="no"
        add_warning "Branch protection could not be read for $REPO:$audit_branch"
      fi

      if gh ruleset check --repo "$REPO" "$audit_branch" >/tmp/verify-git-flow-ruleset.txt 2>/dev/null; then
        ruleset_visible="yes"
      else
        ruleset_visible="no"
        add_warning "Ruleset visibility could not be confirmed for $REPO:$audit_branch"
      fi

      if [[ "$protection_visible" == "yes" ]]; then
        if jq -e '.required_status_checks != null' /tmp/verify-git-flow-protection.json >/dev/null 2>&1; then
          required_checks_ready="likely_yes"
        else
          required_checks_ready="not_configured"
          add_warning "Required status checks are not configured on the protected branch"
        fi
      else
        required_checks_ready="unknown"
      fi
    else
      repo_status="failed"
      add_failure "Could not inspect repository: $REPO"
    fi
  fi
fi

verdict="PASS"
if [[ ${#failures[@]} -gt 0 ]]; then
  verdict="FAIL"
elif [[ ${#warnings[@]} -gt 0 ]]; then
  verdict="PASS_WITH_WARNINGS"
fi

echo "Verdict: $verdict"
echo
echo "Local installation checks"
echo "- Skills directory present: $([[ -d "$SKILLS_DIR" ]] && echo yes || echo no)"
echo "- git-flow-check present: $([[ -d "$SKILLS_DIR/git-flow-check" ]] && echo yes || echo no)"
echo "- git-flow-add-restriction present: $([[ -d "$SKILLS_DIR/git-flow-add-restriction" ]] && echo yes || echo no)"
echo "- verify-git-flow-setup present: $([[ -d "$SKILLS_DIR/verify-git-flow-setup" ]] && echo yes || echo no)"
echo "- gh installed: $(command -v gh >/dev/null 2>&1 && echo yes || echo no)"
echo "- jq installed: $(command -v jq >/dev/null 2>&1 && echo yes || echo no)"
echo "- git installed: $(command -v git >/dev/null 2>&1 && echo yes || echo no)"
echo "- gh auth ready: $auth_ok"

echo
echo "Repository checks"
if [[ -n "$REPO" ]]; then
  echo "- Repo: $REPO"
  echo "- Default branch: $default_branch"
  echo "- Repo inspection: $repo_status"
  echo "- Branch protection visibility: $protection_visible"
  echo "- Ruleset visibility: $ruleset_visible"
  echo "- Required-check readiness: $required_checks_ready"
else
  echo "- Not run"
fi

echo
echo "Findings"
if [[ ${#failures[@]} -eq 0 && ${#warnings[@]} -eq 0 ]]; then
  echo "- No issues found."
else
  for item in "${failures[@]}"; do
    echo "- FAIL: $item"
  done
  for item in "${warnings[@]}"; do
    echo "- WARN: $item"
  done
fi

echo
echo "Fixes"
if [[ ${#failures[@]} -eq 0 && ${#warnings[@]} -eq 0 ]]; then
  echo "- No changes required."
else
  for item in "${failures[@]}"; do
    case "$item" in
      "Missing directory:"*) echo "- Create the missing skill directory." ;;
      "Missing file:"*) echo "- Create the missing file in the expected path." ;;
      "Missing required tool:"*) echo "- Install the missing local tool." ;;
      "Could not inspect repository:"*) echo "- Confirm repository name, access, and gh authentication." ;;
      *) ;;
    esac
  done
  for item in "${warnings[@]}"; do
    case "$item" in
      "Script is not executable:"*) echo "- Run chmod +x on the script." ;;
      "gh is installed but authentication is not ready") echo "- Run gh auth login and confirm access." ;;
      "Branch protection could not be read"*) echo "- Verify repo permissions and branch name." ;;
      "Ruleset visibility could not be confirmed"*) echo "- Verify GitHub plan, permissions, and repo ruleset access." ;;
      "Required status checks are not configured on the protected branch") echo "- Run CI on the repo and configure required checks before enforcing them." ;;
      *) ;;
    esac
  done
fi