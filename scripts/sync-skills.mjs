#!/usr/bin/env node
// Regenerate .claude/skills/ as a symlink view for Claude Code discovery.
// Run:  node scripts/sync-skills.mjs   (also works with: bun scripts/sync-skills.mjs)
//
// Sources:
//   .agents/skills/**   → vendored BASE skills (read-only, managed by `npx skills add`)
//   skills/**           → your OWN skills + forks (the source of truth)
//
// Rules:
//   - A "skill" is any directory containing a SKILL.md.
//   - skills/deprecated/** and skills/in-progress/** are skipped (not exposed in discovery).
//   - Skill identity is the frontmatter `name:` (falls back to the directory name).
//   - On a name collision between an OWN skill and a BASE skill, the OWN fork wins
//     (logged as an override). Same-name entries that resolve to the same real path
//     (e.g. a base symlink pointing at an own skill) are de-duplicated silently.
//   - Two OWN skills sharing a name is a hard error.
//
// .claude/skills/ is fully regenerated each run and is gitignored — never edit it by hand.

import {
  readdirSync,
  readFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
  statSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { join, dirname, relative, resolve, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DIR = join(repoRoot, '.agents', 'skills');
const OWN_DIR = join(repoRoot, 'skills');
const OUT_DIR = join(repoRoot, '.claude', 'skills');
// Own-tree subtrees that are never exposed in discovery.
const SKIP_DIRS = [join(OWN_DIR, 'deprecated'), join(OWN_DIR, 'in-progress')];

// Recursively collect every directory that directly contains a SKILL.md.
// Does not descend into a skill's own subdirectories. Follows symlinked dirs.
function findSkillDirs(root) {
  const out = [];
  if (!existsSync(root)) return out;

  const walk = (dir) => {
    if (SKIP_DIRS.some((s) => dir === s || dir.startsWith(s + sep))) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) {
      out.push(dir);
      return; // a skill is a leaf — don't recurse into its bundled files
    }

    for (const e of entries) {
      const full = join(dir, e.name);
      try {
        if (statSync(full).isDirectory()) walk(full); // statSync follows symlinks
      } catch {
        /* dangling symlink — ignore */
      }
    }
  };

  walk(root);
  return out;
}

function skillName(dir) {
  const txt = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const m = txt.match(/^name:\s*(.+?)\s*$/m);
  return m ? m[1].trim() : basename(dir);
}

function realOrSelf(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

// --- Own skills first (so collisions are detected against the source of truth) ---
const own = new Map(); // name -> dir
for (const dir of findSkillDirs(OWN_DIR)) {
  const name = skillName(dir);
  const prev = own.get(name);
  if (prev) {
    if (realOrSelf(prev) === realOrSelf(dir)) continue;
    console.error(
      `✖ own-vs-own name collision: "${name}"\n   ${relative(repoRoot, prev)}\n   ${relative(repoRoot, dir)}`,
    );
    process.exit(1);
  }
  own.set(name, dir);
}

// --- Base skills, with own-wins precedence ---
const registry = new Map(own); // name -> dir (starts with all own skills)
const overrides = [];
let baseCount = 0;
for (const dir of findSkillDirs(BASE_DIR)) {
  const name = skillName(dir);
  const existing = registry.get(name);
  if (existing) {
    if (realOrSelf(existing) !== realOrSelf(dir)) overrides.push(name);
    continue; // own wins (or same file) — skip base
  }
  registry.set(name, dir);
  baseCount++;
}

// --- Regenerate .claude/skills/ ---
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, dir] of registry) {
  symlinkSync(relative(OUT_DIR, dir), join(OUT_DIR, name), 'dir');
}

console.log(
  `✓ Synced .claude/skills/: ${registry.size} skills (${baseCount} base, ${own.size} own, ${overrides.length} override${overrides.length === 1 ? '' : 's'})`,
);
if (overrides.length) {
  console.log(`  own forks shadow base: ${overrides.sort().join(', ')}`);
}
