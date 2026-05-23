# Project Glossary & Domain

This repo contains AI Agent skills for software engineering.

I am highly inspired by [Matt Pocock's work on AI Agent skills](https://github.com/mattpocock/skills) and I intend to use his skills as a foundation for my own.

---

## Conventions

- I install the **base skills** using the `npx skills@latest add <skill-name>` command, which creates a skill folder under `.agents/skills/<skill-name>`.
- My **own skills**, which are either, completely new, or forks of existing skills, are stored under `skills/<domain>/<subdomain>/<skill-name>`.
- I use the `metadata` field in the skill YAML front matter to track version, author, and timestamps for my own skills. I ignore these fields for base skills.

---

## Goal

The goal of this repo is to build a **personal library of engineering skills** that I can use to create multiple **AI Agent-powered software development workflows**.

These workflows will cover the _entire software development lifecycle_, from **discovery and scoping** to **grilling and specification** to **TDD slicing** to **code generation** to **code review** to **CI/CD**.

Ideally, these workflows can be used by both human engineers and AI agents, enabling a future where AI agents can autonomously build software with minimal human intervention.

Depending on the situation, the user should choose the right workflow, which is just a sequence of skills from this library. For example:

- For a **green field** project with a lot of ambiguity, the user might choose:
  1. `/to-project-prd` - This takes a vague product idea and turns it into a high-level PRD with project requirements, user stories and acceptance criteria, etc. - Under the hood, it used a light version of `/grill-me` (proposed name: `/prd-grilling`) to play the role of a product manager and ask the user clarifying questions to flesh out the details. In this one the user is a stakeholder or founder and the Agent is acting as a PM.
  2. `/to-modules` - This takes the high-level PRD produced by the previous skill and decomposes it into a set of modules, which are logical groupings of features. Again, it uses a version of `/grill-with-docs` (proposed name: `/modules-grilling`) to ask clarifying questions about the domain and the relationships between concepts to find natural seams in the system. In this one the user is the PM and the Agent is acting as a technical architect. Each module must have its own dir under `/modules/<module-slug>/module.md`. The `module.md` file is a temporary handoff file that contains high level inforamtion about the module. So 1 high-level PRD -> many modules.
  3. `/to-features` - For each module identified in the previous step, this skill decomposes it into a set of features, which are complete user capabilities that can be built and shipped independently. It uses the another version of `/grill-with-docs` (proposed name: `/features-grilling`) approach to ask clarifying questions about the user value, the domain concepts involved, and the natural seams in the codebase to find good feature boundaries. In this one the user is the technical architect and the Agent is acting as a team leader. Each feature gets its own dir under `docs/features/<feature-slug>/feature.md`. The `feature.md` file is a temporary handoff file that contains high level information about the feature, including its value proposition, its domain concepts, and its recommended next steps. So 1 module -> many features.
  4. `/grill-with-docs-stateful` - For each feature identified in the previous step, this skill takes the `feature.md` file and asks detailed clarifying questions to reach a deep understanding of the feature, its edge cases, its failure modes, and its implementation details. It updates the root `CONTEXT.md` file with new domain concepts and invariants discovered during grilling. In this one the user is the team leader and the Agent is acting as a senior engineer. This might require muiltiple grilling sessions, thus the new stateful fork. Each feature is mapped into grilling session artifact. Performing more than 1 grilling session just updates the same artifact. So many grilling sessions -> 1 feature artifact. The artifact is named "grilling-session.md" and lives inside the feature dir under `docs/features/<feature-slug>/grilling-session.md`. This stateful version of the skill also has a complete command that indicated when a `grilling-session.md` is ready for PRD creation.
  5. `/to-prd` - This takes the fully grilled `docs/features/<feature-slug>/grilling-session.md` file produced by the previous step and turns it into a detailed PRD that can be handed off to engineers for implementation. It uses the information in the `docs/features/<feature-slug>/grilling-session.md` file, as well as the updated `CONTEXT.md` file, to create a comprehensive specification of the feature, including its user stories, acceptance criteria, edge cases, failure modes, and implementation details. In this one the user is the senior engineer and the Agent is acting as a technical writer. Each feature gets its own PRD under `docs/features/<feature-slug>/PRD.md`. So 1 feature -> 1 PRD.
  6. `/to-issues` - This takes the detailed `docs/features/<feature-slug>/PRD.md` file produced by the previous step and slices it into a set of engineering tasks that can be tracked in an local issue tracker `docs/features/<feature-slug>/tasks`. It uses the information in the `docs/features/<feature-slug>/PRD.md` and `CONTEXT.md` file to identify the different components of the feature, the dependencies between them, and the logical order of implementation. It then creates a set of issues for each task, with clear descriptions, acceptance criteria, and estimates. In this one the user is the technical writer and the Agent is acting as a project manager. Each PRD.md file -> many issues in `docs/features/<feature-slug>/tasks`.
  7. `/tdd` - This takes one of the issues created in the previous step and implements it using test-driven development. It uses the information in the `docs/features/<feature-slug>/PRD.md`, `CONTEXT.md`, and the issue description to write tests that define the expected behavior of the code, and then writes the minimum amount of code necessary to make those tests pass. In this one the user is the Team Leader and the Agent is acting as a software engineer. Each issue -> 1 TDD slice.
  8. `/code-review` - This takes a completed TDD slice and performs a code review, providing feedback on the implementation, identifying potential bugs, and suggesting improvements. It uses the information in the `docs/features/<feature-slug>/PRD.md`, `CONTEXT.md`, and the issue description to evaluate whether the code meets the requirements and adheres to best practices. In this one the user is the Team Leader and the Agent is acting as a senior QA Engineer. Each completed TDD slice -> 1 code review. The Agent must produce a code review artifact under `docs/features/<feature-slug>/code-reviews/<xx-report>.md`.

--

## Entities

### Module

### Feature

### Issue

### TDD Slice

### Code Review
