# Expected Plugins & Marketplace Sources

## Plugin Manifest

| Plugin | Namespace | Source |
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

## Marketplace Sources

| Marketplace ID | Type | Repository |
|---|---|---|
| `context-mode` | GitHub | `mksglu/context-mode` |

### Settings JSON Shape

The marketplace is registered under `extraKnownMarketplaces` in `~/.claude/settings.json`:

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

## How to Audit

Read `~/.claude/settings.json` and check the `enabledPlugins` object. For each plugin in the manifest above:

- Key exists and `true` → ✅ installed and enabled
- Key exists and `false` → ⚠️ installed but disabled
- Key missing → ❌ not installed

For marketplace sources, check `extraKnownMarketplaces` for the `context-mode` entry.
