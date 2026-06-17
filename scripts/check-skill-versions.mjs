#!/usr/bin/env node
// check-skill-versions.mjs — changesets-style guard.
// Fails if an OWN skill's content changed since the last release tag (v*) but its
// metadata.version was not bumped. Run before tagging a release (or in CI / a hook).
//
// Run:  node scripts/check-skill-versions.mjs
// Exit: 0 = OK (or no release tag yet), 1 = one or more skills need a version bump.
//
// Scope: skills/** (the source of truth), excluding deprecated/ and in-progress/.
// Base skills under .agents/ are not versioned and are ignored.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OWN_DIR = join(repoRoot, 'skills');
const SKIP_DIRS = [join(OWN_DIR, 'deprecated'), join(OWN_DIR, 'in-progress')];

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'], // capture stdout, silence stderr
  }).trim();
}

// git pathspecs/refs always use forward slashes
const toPosix = (p) => p.split(sep).join('/');

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
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* dangling symlink */
      }
    }
  };
  walk(root);
  return out;
}

function versionOf(text) {
  const m = text.match(/^\s*version:\s*(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

// Most recent v* tag, if any.
let lastTag = '';
try {
  lastTag = git(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
} catch {
  lastTag = '';
}
if (!lastTag) {
  console.log('ℹ No v* release tag yet — nothing to diff against. (Pass.)');
  process.exit(0);
}

const needBump = [];
for (const dir of findSkillDirs(OWN_DIR)) {
  const rel = toPosix(relative(repoRoot, dir));

  // Did anything in the skill dir change since the tag?
  let changed = false;
  try {
    execFileSync('git', ['diff', '--quiet', lastTag, '--', rel], { cwd: repoRoot });
  } catch {
    changed = true; // non-zero exit => differences exist
  }
  if (!changed) continue;

  // Version at the tag. If SKILL.md didn't exist then, this skill is new — OK.
  let oldText;
  try {
    oldText = git(['show', `${lastTag}:${rel}/SKILL.md`]);
  } catch {
    continue;
  }

  const oldVer = versionOf(oldText);
  const newVer = versionOf(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
  if (!newVer) {
    needBump.push(`${rel} — missing metadata.version`);
  } else if (oldVer === newVer) {
    needBump.push(`${rel} — changed but still v${newVer}`);
  }
}

if (needBump.length) {
  console.error(`✖ ${needBump.length} skill(s) changed since ${lastTag} without a version bump:`);
  for (const s of needBump) console.error(`   - ${s}`);
  console.error('\nBump metadata.version (and updated_at) in each, then re-run.');
  process.exit(1);
}

console.log(`✓ All skills changed since ${lastTag} have a version bump.`);
