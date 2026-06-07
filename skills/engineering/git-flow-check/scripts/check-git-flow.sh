#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh is required" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 2
fi

REPO="${1:-}"
BRANCH="${2:-}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 OWNER/REPO [branch]" >&2
  exit 2
fi

repo_json="$(gh repo view "$REPO" --json nameWithOwner,defaultBranchRef,isPrivate,url 2>/dev/null)"
default_branch="$(jq -r '.defaultBranchRef.name' <<<"$repo_json")"
repo_url="$(jq -r '.url' <<<"$repo_json")"
branch="${BRANCH:-$default_branch}"

ruleset_summary="none"
if gh ruleset check --repo "$REPO" "$branch" >/tmp/git-flow-ruleset.txt 2>/dev/null; then
  if [[ -s /tmp/git-flow-ruleset.txt ]]; then
    ruleset_summary="present"
  fi
fi

protection_json=""
protection_found="no"
if protection_json="$(gh api "repos/$REPO/branches/$branch/protection" 2>/dev/null)"; then
  protection_found="yes"
fi

mechanism="none"
if [[ "$ruleset_summary" == "present" && "$protection_found" == "yes" ]]; then
  mechanism="both"
elif [[ "$ruleset_summary" == "present" ]]; then
  mechanism="ruleset"
elif [[ "$protection_found" == "yes" ]]; then
  mechanism="branch protection"
fi

if [[ "$protection_found" == "yes" ]]; then
  pr_required="$(jq -r 'if .required_pull_request_reviews then "yes" else "no" end' <<<"$protection_json")"
  approvals="$(jq -r '.required_pull_request_reviews.required_approving_review_count // 0' <<<"$protection_json")"
  checks_required="$(jq -r 'if (.required_status_checks and (((.required_status_checks.contexts // []) | length) > 0 or (((.required_status_checks.checks // []) | length) > 0))) then "yes" else "no" end' <<<"$protection_json")"
  enforce_admins="$(jq -r 'if .enforce_admins.enabled == true then "yes" else "no" end' <<<"$protection_json")"
  force_pushes="$(jq -r 'if .allow_force_pushes.enabled == false then "blocked" else "allowed_or_unknown" end' <<<"$protection_json")"
  deletions="$(jq -r 'if .allow_deletions.enabled == false then "blocked" else "allowed_or_unknown" end' <<<"$protection_json")"
else
  pr_required="unknown"
  approvals="unknown"
  checks_required="unknown"
  enforce_admins="unknown"
  force_pushes="unknown"
  deletions="unknown"
fi

default_branch_protected="$([[ "$mechanism" != "none" ]] && echo yes || echo no)"
direct_pushes_blocked="$([[ "$pr_required" == "yes" ]] && echo yes || echo no)"

solo_review_policy="yes"
if [[ "$approvals" != "unknown" ]] && [[ "$approvals" -gt 0 ]]; then
  solo_review_policy="warning"
fi

verdict="PASS"
reasons=()
fixes=()

if [[ "$default_branch_protected" == "no" ]]; then
  verdict="FAIL"
  reasons+=("No ruleset or branch protection detected on $branch")
  fixes+=("Add branch protection or a ruleset to the default branch")
fi

if [[ "$direct_pushes_blocked" == "no" ]]; then
  verdict="FAIL"
  reasons+=("Direct push protection could not be verified via required pull request settings")
  fixes+=("Require pull requests before merging to $branch")
fi

if [[ "$checks_required" == "no" ]]; then
  if [[ "$verdict" == "PASS" ]]; then
    verdict="PASS_WITH_WARNINGS"
  fi
  reasons+=("No required status checks were detected")
  fixes+=("Require at least one CI check before merge")
fi

if [[ "$force_pushes" != "blocked" ]]; then
  verdict="FAIL"
  reasons+=("Force pushes are not clearly blocked")
  fixes+=("Disable force pushes on the default branch")
fi

if [[ "$deletions" != "blocked" ]]; then
  if [[ "$verdict" == "PASS" ]]; then
    verdict="PASS_WITH_WARNINGS"
  fi
  reasons+=("Default branch deletion is not clearly blocked")
  fixes+=("Block deletion of the default branch")
fi

if [[ "$enforce_admins" == "no" ]]; then
  if [[ "$verdict" == "PASS" ]]; then
    verdict="PASS_WITH_WARNINGS"
  fi
  reasons+=("Administrators are not clearly included in enforcement")
  fixes+=("Consider enforcing rules for admins too, unless you keep an explicit break-glass override policy")
fi

if [[ "$solo_review_policy" == "warning" ]]; then
  if [[ "$verdict" == "PASS" ]]; then
    verdict="PASS_WITH_WARNINGS"
  fi
  reasons+=("Human approval count is greater than zero, which may be too strict for a solo maintainer")
  fixes+=("Set required approving reviews to 0 for solo repositories, while keeping PRs and CI mandatory")
fi

echo "Verdict: $verdict"
echo
echo "Repository facts"
echo "- Repo: $(jq -r '.nameWithOwner' <<<"$repo_json")"
echo "- URL: $repo_url"
echo "- Default branch: $default_branch"
echo "- Audited branch: $branch"
echo "- Protection mechanism: $mechanism"

echo
echo "Control checks"
echo "- Default branch protected: $default_branch_protected"
echo "- Direct pushes blocked: $direct_pushes_blocked"
echo "- PRs required: $pr_required"
echo "- Required checks enforced: $checks_required"
echo "- Force pushes blocked: $force_pushes"
echo "- Branch deletions blocked: $deletions"
echo "- Admins included: $enforce_admins"
echo "- Solo-friendly review policy: $solo_review_policy"

if [[ "$approvals" != "unknown" ]]; then
  echo "- Required approving reviews: $approvals"
fi

echo
echo "Findings"
if [[ ${#reasons[@]} -eq 0 ]]; then
  echo "- No critical findings."
else
  for r in "${reasons[@]}"; do
    echo "- $r"
  done
fi

echo
echo "Fixes"
if [[ ${#fixes[@]} -eq 0 ]]; then
  echo "- No changes required."
else
  printf '%s\n' "${fixes[@]}" | awk '!seen[$0]++' | sed 's/^/- /'
fi