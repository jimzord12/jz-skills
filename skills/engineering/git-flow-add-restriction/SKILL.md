---
name: git-flow-add-restriction
description: Add or tighten GitHub Flow restrictions for a GitHub repository using gh CLI in a solo developer setup. Use when asked to enforce pull-request-only main branch protection, required status checks, force-push blocking, or other branch safety rules without requiring a second reviewer.
---

# Git Flow Add Restriction

Use this skill to enforce a practical GitHub Flow policy on GitHub repositories where one developer does most of the work. The purpose is to protect `main`, require branch-and-PR workflow, and keep CI as the main gate, without accidentally creating a policy that blocks the sole maintainer from shipping changes.[web:141][web:143]

## What this skill does

This skill modifies repository restrictions using `gh` and the GitHub API.[web:19][web:129]

It is designed for:

- Solo-maintainer repositories.
- Small personal projects.
- Repos that want GitHub Flow safety without mandatory second-person approval.

## When to use it

Use this skill when asked to:

- Protect `main`.
- Require pull requests before merge.
- Require CI checks before merge.
- Disable force pushes or branch deletion.
- Apply a solo-friendly GitHub Flow baseline to one or more repos.

Do not use this skill unless the operator has admin rights on the target repository, because protected branch settings are administrative controls.[web:19][web:127][web:129]

## Solo-maintainer enforcement policy

For solo repos, the recommended baseline is:

- Require pull requests before merging to `main`, or to the detected default branch.[web:19][web:141]
- Require zero mandatory human approvals by default.
- Require at least one status check when CI exists.[web:32][web:143]
- Disable force pushes on the protected branch.[web:127][web:143]
- Disable deletion of the protected branch.[web:127]
- Optionally include admins in enforcement to prevent bypassing policy accidentally, which is often useful for solo self-discipline.[web:141]

This setup preserves the GitHub Flow discipline while avoiding the common solo-maintainer trap of requiring a reviewer that does not exist.[web:141]

## Safety rules

Always follow these rules before making changes.

1. Confirm the target repo explicitly.
2. Detect the default branch instead of assuming it is `main`.
3. Read the current protection state before writing changes.
4. Prefer the smallest safe change set.
5. Never require a named status check unless that check already exists or the user explicitly requested it, because GitHub only allows required checks that have recently run in the repository.[web:99][web:32]
6. Warn before enabling requirements that could lock the maintainer out of normal merges.
7. After applying changes, verify them with a read-back audit.

## Inputs

Required input:

- `OWNER/REPO`

Optional input:

- Branch name, otherwise use the default branch.
- Required status check names, for example `ci` or `test`.
- Whether admins should be enforced.
- Whether branch deletion should be blocked.

## Default recommended settings

Unless the user asks otherwise, apply this baseline to the default branch:

- Require pull request reviews before merging: enabled.[web:19]
- Required approving review count: `0`.
- Dismiss stale reviews: `false`.
- Require code owner reviews: `false`.
- Required status checks: preserve existing checks if present; otherwise do not invent one.[web:99][web:32]
- Enforce admins: `true` for stricter self-discipline, but mention this explicitly.[web:141]
- Allow force pushes: `false`.[web:127][web:143]
- Allow deletions: `false`.[web:127]
- Required linear history: `false` unless the user wants it.

## Execution procedure

### Step 1: Resolve repository and branch

```bash
gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,url
```

Use the default branch if none is supplied.

### Step 2: Read current protection

```bash
gh api repos/OWNER/REPO/branches/BRANCH/protection
```

If the endpoint returns not found or forbidden, explain whether the problem is missing permissions or missing protection.[web:129]

### Step 3: Build the target policy payload

Build JSON that preserves necessary existing fields and updates only the intended controls. For solo repos, set `required_approving_review_count` to `0` unless the user explicitly wants a higher value.[web:141]

### Step 4: Apply protection

Use `gh api -X PUT` to write branch protection through the GitHub REST API.[web:19][web:129][web:131]

### Step 5: Verify after write

Read back the branch protection object and confirm the expected controls are active.

## Recommended payload shape

A safe solo baseline looks like this:

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
```

If specific checks exist, replace `required_status_checks` with a proper object.[web:19][web:129]

## Output format

When this skill runs, return:

### 1. Planned changes

A short bullet list of what will be changed.

### 2. Risk notes

State whether the new policy could block merges, especially if required checks are named.[web:99]

### 3. Apply result

- Success or failure.
- Branch audited.
- Controls enabled.

### 4. Verification

Summarize the read-back result.

## Guardrails

- Do not require 1 approval by default for a solo repo.[web:141]
- Do not add fake required status checks.[web:99][web:32]
- Do not remove existing needed checks unless asked.
- Do not assume the
