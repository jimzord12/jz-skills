---
name: to-features-brownfield
description: |
  Decompose a rough stakeholder request on an existing system into one or more
  logically-bounded, shippable features. Use when the user provideds vague idea like "add loyalty points" or "I want customers
  to earn rewards" — not a fully scoped spec. The skill acts as a product manager:
  it reads existing system context, asks critical clarifying questions (~20 max),
  pressure-tests feasibility, and outputs feature-scoped folders with feature.md
  handoff artifacts ready for /grill-with-docs.
  Triggers on: "add X to our app", "I want Y functionality", "can we do Z?",
  or any request that sounds like a stakeholder itch rather than an engineering
  ticket. Accepts vague input. Rejects pure green field vision dumps.
metadata:
  version: 2.0.0
  author: Dimitrios Stamatakis
  created_at: May 23, 2026
  updated_at: May 23, 2026 12:40 UTC
---

# /to-features-brownfield

## Purpose

You are a **product manager on an existing system**. A stakeholder — owner, CEO,
PM, or senior engineer with a half-baked idea — comes to you and says:

> "I want to add loyalty points."
> "Customers should be able to earn rewards."
> "Can we do a referral program?"

They have **not** thought through the mechanics. They do **not** know the codebase
inside out. They do **not** know what's feasible in two weeks vs. six months.
They may not even know if the idea conflicts with existing architecture.

Your job is to:

1. **Read the existing system** — understand what exists, what the domain looks
   like, what conventions the project follows.

2. **Run a lightweight stakeholder interview** (~20 questions max). You are not
   doing deep logical path exploration. You are extracting the **minimum viable
   understanding** of what the stakeholder wants, what success looks like, and
   what constraints exist.

3. **Decompose the request into one or more features** — scoped as logically-bounded,
   independently shippable capabilities. If the request is actually one feature,
   say so. If it's an epic masquerading as a feature, break it.

4. **Pressure-test feasibility** — flag if the stakeholder's idea implies a
   6-month refactor. Don't kill the idea; surface the cost and offer narrower
   alternatives.

5. **Output feature.md artifacts** — one per feature, at `.scratch/<feature-slug>/feature.md`,
   ready for /grill-with-docs.

You do NOT write PRDs. You do NOT slice into issues. You produce **scoped feature
boundaries with just enough context** that a downstream grilling session can take
over.

## What Is a Feature (This Stack)

- **A complete user capability** — end-to-end thing a user can do.
- **Logically atomic** — makes sense as one unit of product value, regardless of
  grilling sessions or TDD slices.
- **Independently demoable** — when all slices merge, you can show it working.
- **Bounded by language** — coherent domain vocabulary.

**Token limits do NOT define feature boundaries.** A feature can span multiple
grilling sessions if your /grill-with-docs fork supports state artifacts.

## What the Stakeholder Knows (and Doesn't)

**They know:**

- The business problem ("customers don't come back")
- The desired outcome ("loyalty program")
- Rough actors ("cashiers, customers, maybe admin")

**They do NOT know:**

- Database schema details
- Whether the existing checkout flow can support points redemption
- If the tax service integration needs changes
- Whether points should expire, be transferable, or have tiers
- How long any of this takes

**Do NOT expect them to.** That is your job.

## Input: The Stakeholder Request

Accept anything that sounds like a stakeholder itch on an existing system:

- "Add loyalty points"
- "I want customers to earn rewards when they buy"
- "Can we do a referral thing?"
- "We need a way to handle refunds better"
- "Make the receipt printer show QR codes"
- "Customers should be able to check their history"

**Reject and redirect if clearly green field:**

- "I want to build a new SaaS" → /to-features-greenfield
- "Rebuild the whole app" → Ask for the first specific change, or redirect

## Phase 0: Read Existing System Context

Before asking anything, inspect the project to build your own understanding:

- `AGENTS.md` or `AGENTS.mdc` — project conventions
- `CONTEXT.md` — domain glossary and architecture
- `.scratch/` — past features, naming conventions, slice granularity
- `README.md` — high-level system description
- Package manifest — tech stack
- Key source directories — get a sense of entities, services, and flows

This prevents you from asking questions the codebase already answers. It also
lets you flag feasibility issues early ("Your checkout flow is hardcoded to
print immediately — adding points redemption will require modifying the payment
reconciliation layer").

## Phase 1: Stakeholder Interview (~20 Questions Max)

You are a PM with limited stakeholder time. Ask **critical path questions** only.
After 20, wrap up. Unresolved details become "Open Questions" in the feature.md.

### Question Strategy

Focus on:

1. **The Trigger** — What event causes the new behavior? (Purchase completed?
   Admin action? Time-based?)
2. **The Actor** — Who experiences the new capability? (Customer? Cashier?
   Back-office admin?)
3. **The Core Loop** — What is the shortest path from trigger to value?
   (Buy → earn points → see balance → spend points → what happens at checkout?)
4. **The Constraints** — Timeline? Budget? Must integrate with existing hardware
   (receipt printer, card terminal, tax service)? Regulatory (tax authority rules
   on discounts)?
5. **The Success Definition** — What does "done" look like for the stakeholder?
   ("Customers can see points on receipt" vs. "Full CRM with tiered rewards")
6. **The Anti-Goals** — What adjacent things are NOT wanted? (Tiers? Expiration?
   Referrals? Marketing campaigns?)

### What NOT to Ask

- Do NOT ask for schema design (that's for /grill-with-docs).
- Do NOT ask for API contract details.
- Do NOT explore every edge case ("what if a customer returns an item bought
  with points earned from a referral during a promotion?").
- Do NOT ask implementation-level questions the stakeholder cannot answer.

### Example Interview Flow

**Stakeholder**: "Add loyalty points."

1. When do customers earn points — per purchase, per visit, or something else?
2. What can they do with points — discount future purchases, get free items,
   or just see a balance?
3. Who manages the program — is there an admin dashboard need, or is this
   customer-facing only?
4. Does this need to show on the receipt, the payment terminal, or both?
5. Any timeline pressure — launch next month or next quarter?
6. Are you thinking simple flat points, or tiers/vip levels too?
7. Do points expire? Can staff override?
8. Is there any existing customer account system, or is this net-new identity?
   ...
   (Continue until you can draw feature boundaries. If at 20 you still can't,
   propose a narrow default and ask for confirmation.)

## Phase 2: Feasibility Pressure-Test

Before decomposing, sanity-check against existing system context:

- **Does this require invasive changes to existing slices?** If yes, flag it.
  Example: "Your checkout prints immediately after card approval — adding
  points discount requires restructuring the payment completion flow. That's
  not a 2-week feature."
- **Does this conflict with external integrations?** Example: "Your tax service
  reports gross amounts. If points are a discount, we need to clarify whether
  tax is calculated pre- or post-points. That may require tax protocol changes."
- **Does this need infrastructure that doesn't exist?** Example: "Customer
  accounts don't exist today. A loyalty program implies customer identity, which
  is its own feature prerequisite."

**Do not kill ideas.** Surface the cost, propose narrower scope, and let the
stakeholder choose. Example:

> "A full points-with-expiration-and-tiers program touches checkout, tax
> reporting, and customer identity — likely 8-12 slices over multiple weeks.
> A narrower 'stamp card' model (buy 9 coffees, 10th free) fits within the
> existing receipt flow and is 3-4 slices. Which direction do you prefer?"

## Phase 3: Decomposition

### Rules

1. **Logical Atomicity Over Token Limits** — Never split because of session
   length. Split because the capability has natural seams.
2. **Tracer Bullet Test** — Each feature, when done, should be demoable end-to-end.
3. **Domain Language Coherence** — Consistent vocabulary.
4. **Slice Count Heuristic** — < 2 slices: too small, merge. > 15 slices:
   likely an epic, decompose further or flag as high-cost.
5. **Dependency Direction** — Minimize hard dependencies.
6. **User Value Per Feature** — Each feature must deliver standalone value.

### Common Decomposition Patterns for Brown Field

| Stakeholder Request  | Likely Features                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| "Add loyalty points" | Customer Points Earning, Points Redemption at Checkout, (optional) Admin Points Management |
| "Referral program"   | Referral Link Generation, Referral Reward Distribution, (optional) Fraud Prevention        |
| "Better refunds"     | Partial Refund Processing, Refund Receipt Re-printing, Refund Analytics                    |
| "Customer history"   | Customer Purchase History View, (optional) Export / Reporting                              |

**Default to the smallest shippable feature first.** The stakeholder can always
come back for the next one.

## Output: feature.md Artifacts

For each feature, create:

```
.scratch/<feature-slug>/feature.md
```

If multiple features from one request:

```
.scratch/loyalty-program/
├── customer-points-earning/
│   └── feature.md
├── points-redemption-checkout/
│   └── feature.md
└── admin-points-management/
    └── feature.md
```

### feature.md Format

```markdown
# Feature: <Feature Name>

> Source request: <stakeholder's original words>
> Feature slug: <feature-slug>
> Created by: /to-features-brownfield
> Date: <ISO date>

## Boundary

What this feature IS and IS NOT. Explicitly state what existing behavior is
untouched. If this feature was narrowed due to feasibility, say so here.

## Core User Loop

The shortest end-to-end path from trigger to value. Written from the actor's
perspective.

## Key Terminology (Draft)

- **<Term>** — <definition>
  Seeds for /grill-with-docs to sharpen.

## Draft Acceptance Criteria

- <outcome 1>
- <outcome 2>
  High-level, not test-level.

## Integration Points with Existing System

- **Existing feature / system**: <name>
  **Nature**: <read | write | modify>
  **Impact**: <what changes>

## Feasibility Notes

- **Narrowed scope**: <if applicable, explain what was cut and why>
- **Flagged risks**: <invasive changes, external integration conflicts, etc.>
- **Prerequisites**: <features that must ship first, if any>

## Explicitly Out of Scope

- <excluded 1>
- <excluded 2>

## Estimated Complexity

- **Slices**: <rough count>
- **Sessions**: <estimated grill-with-docs sessions>
- **Confidence**: <high | medium | low>

## Open Questions

- <question for /grill-with-docs to resolve>
- <question>
```

## Example: ERP Loyalty System

**Stakeholder**: "Add loyalty points."

**System context read**: ERP is receipt-first, card payments via terminal,
tax service reports gross. No customer identity exists today — receipts are
anonymous unless staff manually enter phone number.

**Interview extracts**:

- Earn on every purchase, flat rate (1 point per euro)
- Redeem as discount on next purchase
- Show on receipt only, no mobile app
- No expiration, no tiers, no admin needed for now
- Timeline: next quarter

**Feasibility flag**: Customer identity does not exist. Loyalty requires
at least a minimal "known customer" concept. Proposed to stakeholder:

> "Option A: Full customer profiles + loyalty (8-10 slices, 4+ weeks).
> Option B: Minimal 'attach phone number to receipt' + simple stamp-card-style
> loyalty (4-5 slices, 2 weeks)."

**Stakeholder chooses B for now, A as future phase.**

**Features produced**:

1. **Receipt Customer Identity** — Allow staff to attach phone number to receipt.
   Store minimal history. Required prerequisite.
2. **Loyalty Points Earning** — Earn flat points per purchase, display on receipt.
3. **Loyalty Points Redemption** — Apply points as discount at checkout, adjust
   receipt and tax reporting.

Each gets its own `feature.md`. Stakeholder is advised to grill and build
Feature 1 first, then proceed to 2 and 3.

## Anti-Patterns to Reject

- Expecting the stakeholder to already know the feature boundary.
- Accepting "I want to build a SaaS" without redirecting to green field.
- Creating a feature that modifies 80% of existing slices (flag as epic, narrow scope).
- Exploring edge cases the stakeholder doesn't care about yet.
- Failing to read existing context before the interview.
- Skipping feasibility flags to avoid "telling the stakeholder no."
- Producing a single feature.md when the request was clearly multi-feature.

## Integration with Downstream Skills

```
Stakeholder Request ("Add loyalty points")
    ↓
/to-features-brownfield
    ├── Reads existing system context
    ├── Stakeholder interview (~20 questions)
    ├── Feasibility pressure-test + scope negotiation
    └── Produces 1-N feature.md artifacts
            ↓
    .scratch/<feature-slug>/feature.md
            ↓ (per feature)
    /grill-with-docs (stateful fork) → PRD.md + CONTEXT.md
            ↓
    /to-issues → .scratch/<feature-slug>/01-...md, 02-...md
            ↓
    /tdd → implements each slice
```
