# Expected Plugins & Marketplace Sources

The manifest this skill audits against. The audit *procedure* lives in Step 4 of `SKILL.md`;
this file is only the list of what should be there.

## Plugin Manifest

| Plugin | Install id | Marketplace |
|---|---|---|
| frontend-design | `frontend-design@claude-plugins-official` | claude-plugins-official |
| superpowers | `superpowers@claude-plugins-official` | claude-plugins-official |
| context7 | `context7@claude-plugins-official` | claude-plugins-official |
| skill-creator | `skill-creator@claude-plugins-official` | claude-plugins-official |
| code-simplifier | `code-simplifier@claude-plugins-official` | claude-plugins-official |
| playwright | `playwright@claude-plugins-official` | claude-plugins-official |
| claude-md-management | `claude-md-management@claude-plugins-official` | claude-plugins-official |
| typescript-lsp | `typescript-lsp@claude-plugins-official` | claude-plugins-official |
| ralph-loop | `ralph-loop@claude-plugins-official` | claude-plugins-official |
| claude-code-setup | `claude-code-setup@claude-plugins-official` | claude-plugins-official |
| context-mode | `context-mode@context-mode` | mksglu/context-mode (GitHub) |

Total: **11 plugins**

> This list is a hand-maintained snapshot of one person's setup. Refresh it from a known-good
> machine with `claude plugin list --json` rather than editing it from memory.

## Marketplace Sources

| Marketplace ID | Type | Repository | Registered by default |
|---|---|---|---|
| `claude-plugins-official` | GitHub | `anthropics/claude-plugins-official` | Yes |
| `context-mode` | GitHub | `mksglu/context-mode` | **No — must be added** |

Add the missing one with:

```sh
claude plugin marketplace add mksglu/context-mode
```

Which is equivalent to this entry under `extraKnownMarketplaces` in the resolved `settings.json`
(shown for recognition when reading a settings file — prefer the CLI for writing it):

```json
{
  "extraKnownMarketplaces": {
    "context-mode": {
      "source": {
        "source": "github",
        "repo": "mksglu/context-mode"
      }
    }
  }
}
```
