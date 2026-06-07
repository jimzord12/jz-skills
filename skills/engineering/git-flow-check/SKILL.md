---
name: git-flow-check
description: Verify whether a GitHub repository is correctly configured for GitHub Flow, especially for a solo developer setup. Use when asked to audit branch protection, required checks, pull request rules, rulesets, or whether main is safely protected without blocking a single maintainer workflow.
---

# Git Flow Check

Use this skill to inspect whether a repository is actually enforcing a practical GitHub Flow policy for a solo maintainer. A solo setup still benefits from GitHub Flow, but the restrictions should emphasize branch safety, pull requests, CI, and auditability rather than requiring another human reviewer on every change.[web:127][web:129]

## What this skill does

This skill answers four questions:

1. Is the default branch protected enough for GitHub Flow?
2. Is the policy workable for a single maintainer?
3. Are required checks and merge rules actually enforced?
4. What is missing, risky, or overly strict?

## When to use it

Use this skill when the task involves any of the following:

- Checking whether `main` is protected.
- Auditing GitHub Flow readiness.
- Inspecting rulesets or branch protection.
- Verifying whether a repository is safe for PR-based solo development.
- Producing a pass/fail report with actionable fixes.

Do not use this skill to modify settings. It is read-only by default.

## Solo-maintainer GitHub Flow policy

For a solo developer, the goal is not “two-person review.” The goal is “no unsafe direct changes to `main`, every change goes through a branch and PR, and automation proves the branch is healthy before merge.” GitHub branch protection supports this through pull-request requirements, status checks, force-push blocking, and deletion protection.[web:127][web:129]

### Minimum acceptable policy

A repository passes this skill if all of the following are true:

- The default branch exists and is clearly the stable branch, usually `main`.
- Direct pushes to the default branch are blocked by branch protection or an equivalent ruleset.
- Pull requests are required before merging to the default branch.
- At least one required status check is enforced before merge, or there is a documented reason why none can exist yet.[web:93][web:94]
- Force pushes are disallowed on the default branch unless there is an explicit emergency exception policy.[web:127]
- Branch deletion protection or equivalent safe defaults exist for the default branch.[web:127]

### Recommended solo-friendly policy

These are strongly recommended, but not always mandatory:

- Require branches to be up to date before merge when CI supports it.
- Include administrators in the protection scope, unless there is a deliberate break-glass override process.[web:127]
- Auto-delete merged branches.
- A CI workflow that runs on pull requests.[web:94]
- A PR template describing summary, validation, and rollback notes.
- Signed commits, code scanning, or deployment checks for higher-risk repos.

### Not required for solo development

These are often useful for teams, but should not be mandatory by default for a solo maintainer:

- One or more required approving reviews from another human.
- CODEOWNERS review enforcement.
- Merge queue.

If such rules exist, report them as “possibly over-restrictive for solo workflow” unless the user explicitly wants them.

## Inputs

This skill expects one of these inputs:

- A GitHub repository slug like `OWNER/REPO`.
- A local git checkout with `origin` pointing to GitHub.
- An explicit branch name, otherwise use the default branch.

## Required tools and assumptions

Preferred tools:

- `gh`
- `jq`
- standard shell utilities

Authentication assumptions:

- `gh auth status` should succeed.
- The token should have enough permission to read repository metadata and branch protection.

## Audit procedure

Follow these steps in order.

### Step 1: Identify the repository and default branch

Resolve the repository slug and default branch first.

```bash
gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,isPrivate,url
```

Record:

- `nameWithOwner`
- `defaultBranchRef.name`
- repository URL
- privacy status

### Step 2: Inspect rulesets that apply to the default branch

Check rulesets first because some repos use repository rulesets instead of classic branch protection.

```bash
gh ruleset check --repo OWNER/REPO --default
```

If structured data is needed, use `gh api` against repository rules endpoints if available in the environment.

### Step 3: Inspect branch protection on the default branch

Fetch the protection object for the default branch.

```bash
gh api repos/OWNER/REPO/branches/BRANCH/protection
```

Capture at least these fields when present:

- required pull request reviews
- required status checks
- enforce admins
- allow force pushes
- allow deletions
- required linear history
- restrictions

### Step 4: Determine whether PR-only flow is enforced

A repo is PR-only if direct pushes are blocked and merge happens through pull requests or equivalent protected mechanisms.[web:127][web:129]

Check:

- direct push blocked
- pull requests required
- merge not possible while required checks fail.[web:93][web:94]

### Step 5: Determine whether the policy is solo-friendly

Flag these conditions:

- Human approval count required above zero.
- Code owner reviews required.
- No bypass path for the sole maintainer when absolutely necessary.

These are not automatic failures, but they may make the setup impractical for one developer.

### Step 6: Classify the result

Return one of these statuses:

- `PASS`: Safe and practical GitHub Flow for a solo maintainer.
- `PASS_WITH_WARNINGS`: Safe enough, but has friction or missing recommended controls.
- `FAIL`: Not actually enforcing GitHub Flow or exposes `main` to unsafe change paths.

## Decision rules

### PASS

Use `PASS` when all minimum controls exist and nothing critical is missing.

### PASS_WITH_WARNINGS

Use this when the branch is protected but one or more of the following is true:

- No required status checks yet.
- Admins are excluded from enforcement.
- Merged branches are not auto-deleted.
- Solo workflow is blocked by mandatory outside approval.

### FAIL

Use `FAIL` when any of the following is true:

- No branch protection or equivalent ruleset applies to the default branch.
- Direct pushes to the default branch are allowed.
- Pull requests are not required.
- Force pushes are allowed without an explicit emergency exception rationale.
- The branch can be merged despite failing required checks.[web:93][web:94][web:127]

## Output format

Always return a compact audit report with these sections in this order:

### 1. Verdict

One line:

- `PASS`
- `PASS_WITH_WARNINGS`
- `FAIL`

### 2. Repository facts

- Repo
- Default branch
- Protection mechanism found: `ruleset`, `branch protection`, `both`, or `none`

### 3. Control checks

Use a checklist-like list:

- Default branch protected: yes/no
- Direct pushes blocked: yes/no
- PRs required: yes/no
- Required checks enforced: yes/no
- Force pushes blocked: yes/no
- Branch deletions blocked: yes/no
- Admins included: yes/no/unknown
- Solo-friendly review policy: yes/no/warning

### 4. Findings

List only the non-obvious findings.

### 5. Fixes

List the smallest changes needed to reach a `PASS` state.

## Guardrails

- Do not assume that a green checkmark in the UI means checks are required.[web:93][web:94]
- Do not assume that branch protection exists just because PRs are commonly used.
- Distinguish between “missing for GitHub Flow safety” and “missing for an ideal mature setup.”
- For solo maintainers, prefer safety plus flow over team-style review bureaucracy.
- If API access is denied, say which data could not be verified and downgrade confidence.

## Scripts

Use the helper script when available:

```bash
bash scripts/check-git-flow.sh OWNER/REPO
```

If a branch name is supplied:

```bash
bash scripts/check-git-flow.sh OWNER/REPO main
```

## Example interpretation

Example: the repo requires PRs, blocks direct pushes, blocks force pushes, and requires a `ci` check, but does not require another human approval. That is a good solo GitHub Flow setup and should usually be reported as `PASS`.[web:93][web:94][web:127]
