---
name: to-features-greenfield
description: |
  Discover, decompose, and scope raw product ideas / epics into logically-bounded
  features. Use when the user has a green field vision — a brain dump, startup idea,
  "I want to build X", or an unscoped epic. Runs a lightweight discovery grilling
  (~20 questions max), then produces feature-scoped folders with feature.md handoff
  artifacts ready for /grill-with-docs.
  Triggers on: "I want to build...", "new SaaS idea", "green field", "from scratch",
  raw vision dumps, or any request that sounds like a whole product rather than a single
  capability on an existing system.
version: 1.0.0
author: jimzord-stam
agents: [claude-code, claude-desktop, claude-api]
tags: [engineering, planning, decomposition, green-field, pocock-stack]
---

# /to-features-greenfield

## Purpose

You are the **discovery and scoping layer** for green field projects. You take
whatever the user dumps on you — a napkin sketch, a 3am voice memo, a Notion page,
or a vague "I want to build a SaaS" — and do two things:

1. **Lightweight discovery grilling** (~20 questions). You interview the user to
   understand the domain, the core user loop, the actors, the constraints, and the
   minimum viable surface area.

2. **Decomposition into features**. You output one or more `.scratch/<feature-slug>/feature.md`
   artifacts, each scoped as a logically-bounded, independently demoable capability.

You do NOT write PRDs. You do NOT slice into issues. You produce **feature boundaries
with context** — the perfect cold-start input for `/grill-with-docs`.

## What Is a Feature (This Stack)

Same definition across the entire Pocock stack:

- **Complete user capability** — end-to-end thing a user can do.
- **Logically atomic** — makes sense as one unit of product value, regardless of
  how many grilling sessions or TDD slices it needs.
- **Independently demoable** — when all slices are merged, you can show it and it works.
- **Bounded by language** — coherent domain vocabulary that `/grill-with-docs` will
  sharpen into a `CONTEXT.md` glossary.

**Token limits do NOT define feature boundaries.** "User Authentication" is one
feature whether it needs 1 grilling session or 5. The user's fork of `/grill-with-docs`
handles multi-session continuity via state artifacts.

## Input: The Raw Request

Accept anything the user gives you:

- Elevator pitch ("Uber for dog walkers")
- Copy-pasted Notion / Linear / Jira epic
- Voice memo transcript
- Founder rant
- Half-baked PRD that is clearly an epic in disguise
- "I want to build a SaaS project" (yes, this is valid input here — your job is to
  drill down)

## Output: feature.md Artifacts

For each feature identified, create a folder and file at:

```
.scratch/<request-slug>/<feature-slug>/feature.md
```

Example:

```
.scratch/salon-booking/
├── customer-booking/
│   └── feature.md
├── stylist-schedule/
│   └── feature.md
└── owner-analytics/
    └── feature.md
```

If only one feature is identified, still create the folder structure for consistency:

```
.scratch/<request-slug>/<feature-slug>/feature.md
```

### feature.md Format

```markdown
# Feature: <Feature Name>

> Source: <request-slug>
> Feature slug: <feature-slug>
> Created by: /to-features-greenfield
> Date: <ISO date>

## Boundary

One-paragraph definition of what this feature IS and IS NOT. This is the fence
that keeps scope creep out of /grill-with-docs sessions.

## Core User Loop

Describe the primary actor, their trigger, the steps they take, and the outcome.
This becomes the backbone of the PRD.

## Key Terminology (Draft)

- **<Term>** — <brief definition>
- **<Term>** — <brief definition>
  These seeds will be sharpened into CONTEXT.md by /grill-with-docs.

## Draft Acceptance Criteria

- <outcome 1>
- <outcome 2>
- <outcome 3>
  High-level, not test-level. These guide /grill-with-docs in writing the real
  acceptance criteria.

## Integration Points

- **With**: <other feature or external system>
  **Nature**: <data flow, dependency, shared entity>
  Where this feature touches things outside itself.

## Explicitly Out of Scope

- <excluded capability 1>
- <excluded capability 2>
  Critical fence. If it's not here, /grill-with-docs will assume it might be in scope.

## Estimated Complexity

- **Slices**: <rough count, e.g., 5-8> (for /to-issues)
- **Sessions**: <estimated grill-with-docs sessions>
- **Confidence**: <high | medium | low>

## Open Questions

- <question 1>
- <question 2>
  Anything discovered during grilling that /grill-with-docs should resolve.
```

## Phase 1: Lightweight Discovery Grilling

You are NOT doing deep logical path exploration. You are doing **product archaeology**
— excavating enough context to draw clean feature boundaries. Target ~20 questions.
After 20, start wrapping up even if gaps remain (those become "Open Questions" in
the feature.md).

### Question Categories

Ask across these dimensions, but don't be rigid — follow where the conversation leads:

1. **The User** — Who is the primary actor? Secondary actors? What do they
   currently do instead of this product?
2. **The Trigger** — What event or pain point causes the user to engage with
   this feature?
3. **The Core Loop** — What is the shortest complete path from trigger to value
   realization?
4. **The Surface** — Web app? Mobile app? API? Admin dashboard? Public-facing
   vs. internal-only?
5. **The Domain** — What are the key nouns and verbs in this space? What does
   the user call things?
6. **Constraints** — Timeline, team size, budget, regulatory (GDPR, PCI-DSS),
   existing tools that must integrate?
7. **Success Definition** — What does "done" look like for the user? What metric
   would move?
8. **Anti-Goals** — What are you explicitly NOT building? What adjacent problems
   are distracting?

### Wrapping Up

Once you have enough to:

- Name 1–5 features with coherent boundaries
- Write a core user loop for each
- List the primary domain terms
- Identify what is clearly out of scope

...stop grilling. Do not chase perfection. Unresolved questions go into `Open Questions`
for `/grill-with-docs` to resolve.

### Example Question Flow

**User**: "I want to build a SaaS project."

1. What industry or domain? (e.g., healthcare, e-commerce, developer tools)
2. Who pays — the end user, their employer, or a third party?
3. What is the one thing a user must be able to do in the first 30 seconds
   that makes them say "this is worth it"?
4. Are there existing tools users cobble together to solve this today?
   What are they?
5. Is there a mobile component, or purely web?
   ...
   (continue until boundaries emerge)

## Phase 2: Decomposition

### Rules

1. **Logical Atomicity Over Token Limits**
   - Never split a feature just because it won't fit in one grilling session.
   - Split only when the user capability itself has natural seams (different actors,
     different business events, different channels).

2. **Tracer Bullet Test**
   - Each feature, when fully implemented, should allow a tracer bullet demo — an
     end-to-end path through all layers that proves the capability works.

3. **Domain Language Coherence**
   - A feature should have a consistent vocabulary. If half talks about "appointments"
     and half about "payments," those are likely two features.

4. **Slice Count Heuristic**
   - < 2 slices → merge into adjacent feature or question if already feature-sized.
   - > 15 slices → likely an epic in disguise, decompose further.

5. **Dependency Direction**
   - Prefer independent features. Use soft dependencies when possible. Hard
     dependencies only when unavoidable.

6. **User Value Per Feature**
   - Each feature must deliver standalone user value. A "setup infrastructure"
     feature is a red flag.

### When Only One Feature

If the request is already feature-sized, still create the folder and feature.md.
Add a note: "This request decomposed to a single feature. Proceed directly to
`/grill-with-docs`."

## Example: Green Field Decomposition

**Request**: "I want a salon booking app where customers book appointments, stylists
manage their schedules, and the owner sees analytics."

**Features**:

1. **Customer Booking** — Browse services, pick stylist, select slot, book.
2. **Stylist Schedule Management** — Set availability, view appointments, block time.
3. **Owner Dashboard** — View bookings, revenue, occupancy analytics.

**Note**: Payments is NOT a separate feature — it's a concern within Customer Booking.
"Buy gift cards" would be its own feature later.

## Anti-Patterns to Reject

- Splitting by layer ("backend feature", "frontend feature", "API feature").
- Splitting by session count ("too big for one grill, so two features").
- Creating a "setup" or "foundation" feature with no standalone user value.
- Accepting a request so vague that zero boundaries emerge after 20 questions
  (push back gently: "I need at least one domain or user type to proceed").

## Integration with Downstream Skills

```
Raw Vision / Epic / Brain Dump
    ↓
/to-features-greenfield → .scratch/<request-slug>/<feature-slug>/feature.md
    ↓ (for each feature)
/grill-with-docs (stateful fork) → PRD.md + CONTEXT.md
    ↓
/to-issues → .scratch/<feature-slug>/01-...md, 02-...md
    ↓
/tdd → implements each slice
```

The `feature.md` is the **handoff contract** between discovery and detailed design.
