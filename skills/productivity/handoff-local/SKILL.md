---
name: handoff-local
description: Compact the current conversation into a handoff document for another agent to pick up. Fork of handoff that saves the doc into the current workspace's tmp/ directory (default root/tmp) instead of the OS temp dir, so it travels with the repo. Use when the user wants a handoff doc kept inside the project.
argument-hint: 'What will the next session be used for?'
metadata:
  original_skill:
    {
      name: handoff,
      author: Matt Pocock,
      local_path: .agents/skills/handoff,
      repo_url: https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff,
    }
  version: 1.0.0
  created_at: Jun 17, 2026
  updated_at: Jun 17, 2026
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

Save to the temporary directory of the user's current workspace, default path: `root/tmp` (created it, if not exists).

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
