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
CHECKS_RAW="${3:-}"
ENFORCE_ADMINS="${4:-true}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 OWNER/REPO [branch] [check1,check2] [enforce_admins:true|false]" >&2
  exit 2
fi

repo_json="$(gh repo view "$REPO" --json nameWithOwner,defaultBranchRef,url)"
default_branch="$(jq -r '.defaultBranchRef.name' <<<"$repo_json")"
branch="${BRANCH:-$default_branch}"

required_status_checks_json="null"

if [[ -n "$CHECKS_RAW" ]]; then
  IFS=',' read -r -a checks <<< "$CHECKS_RAW"

  checks_json="$(
    printf '%s\n' "${checks[@]}" \
      | jq -R . \
      | jq -s 'map(select(length > 0) | {context: ., app_id: -1})'
  )"

  contexts_json="$(
    printf '%s\n' "${checks[@]}" \
      | jq -R . \
      | jq -s 'map(select(length > 0))'
  )"

  required_status_checks_json="$(
    jq -n \
      --argjson contexts "$contexts_json" \
      --argjson checks "$checks_json" \
      '{strict:true, contexts:$contexts, checks:$checks}'
  )"
fi

payload="$(
  jq -n \
    --argjson required_status_checks "$required_status_checks_json" \
    --arg enforce_admins "$ENFORCE_ADMINS" \
    '{
      required_status_checks: $required_status_checks,
      enforce_admins: ($enforce_admins == "true"),
      required_pull_request_reviews: {
        dismiss_stale_reviews: false,
        require_code_owner_reviews: false,
        required_approving_review_count: 0
      },
      restrictions: null,
      required_linear_history: false,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: false,
      lock_branch: false,
      allow_fork_syncing: true
    }'
)"

echo "Planned changes"
echo "- Repository: $REPO"
echo "- Branch: $branch"
echo "- Require PR before merge: yes"
echo "- Required approvals: 0"
echo "- Enforce admins: $ENFORCE_ADMINS"
echo "- Force pushes allowed: no"
echo "- Branch deletion allowed: no"

if [[ -n "$CHECKS_RAW" ]]; then
  echo "- Required checks: $CHECKS_RAW"
else
  echo "- Required checks: none specified; existing or future CI should be configured separately if needed"
fi

echo
echo "Applying protection..."

gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - <<< "$payload" >/tmp/git-flow-protection-write.json

echo
echo "Verification"

verify="$(gh api "repos/$REPO/branches/$branch/protection")"

echo "- PR required: $(jq -r 'if .required_pull_request_reviews then "yes" else "no" end' <<<"$verify")"
echo "- Required approving reviews: $(jq -r '.required_pull_request_reviews.required_approving_review_count // 0' <<<"$verify")"
echo "- Enforce admins: $(jq -r '.enforce_admins.enabled // false' <<<"$verify")"
echo "- Force pushes blocked: $(jq -r '(.allow_force_pushes.enabled | not)' <<<"$verify")"
echo "- Branch deletions blocked: $(jq -r '(.allow_deletions.enabled | not)' <<<"$verify")"

if [[ -n "$CHECKS_RAW" ]]; then
  echo "- Required checks configured: $(jq -r '[.required_status_checks.contexts[]?] | join(\",\")' <<<"$verify")"
fi