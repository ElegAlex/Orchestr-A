# CLAUDE-OPTIMIZATION.md

> **Type**: Self-optimization directive for Claude Code.
> **Priority**: Complements the project `CLAUDE.md`. On conflict, project `CLAUDE.md` wins — but Claude Code must flag the conflict to the user.
> **Behavior**: Act proactively without asking permission for trivial optimizations (redundancies, empty files, obsolete rules). Ask permission for substantial restructuring (>20% of a file's content).
> **Wiring**: Referenced from project `CLAUDE.md` via `@CLAUDE-OPTIMIZATION.md`.

---

## 0. Mission

On first read in a session, Claude Code must:

1. **Audit** the repo configuration (CLAUDE.md, `.claude/`, skills, agents).
2. **Identify** gaps against the principles below and produce a synthetic report (size before / estimated after, expected gains).
3. **Apply** trivial optimizations without asking; submit substantial ones for validation.
4. **Across subsequent sessions**, monitor passively and flag drift.

Goal: configuration discipline aligned with real token consumption, given that Opus 4.7 consumes up to 35% more tokens and Max 20x limits are regularly saturated.

---

## 1. Language policy — CRITICAL

**Configuration files are re-injected into context on every turn.** Their language directly multiplies token consumption by turn count. A French CLAUDE.md at 2500 tokens vs 2000 tokens in English = 500 tokens × ~100 turns per session = 50K tokens saved per session.

### Claude Code MUST:

- **Create all new configuration files in English**, including:
  - `CLAUDE.md` (root and any subdirectory)
  - `.claude/agents/*.md` (frontmatter, descriptions, system prompts)
  - `SKILL.md` files (frontmatter + body)
  - `MEMORY.md`, `AGENTS.md`, any persistent instruction file
  - `.claude/commands/*.md` (custom slash commands)

- **Detect French configuration files during the initial audit** and propose translation to English. Translation is treated as a substantial optimization: present a diff and ask for validation before replacing.

- **Preserve original language** for files NOT re-injected on every turn:
  - User-facing `README.md`, `docs/`, `CHANGELOG.md`
  - Code comments and docstrings (follow team convention)
  - Commit messages, issue/PR descriptions
  - Test fixtures, sample data

### Exception

If the project explicitly mandates French in configuration (sovereignty, audit, or contractual reasons), the project `CLAUDE.md` overrides this rule. Flag the override to the user once and respect it thereafter.

---

## 2. Initial audit — first-contact checklist

```
[ ] Inventory:
    - CLAUDE.md (root + subdirectories)
    - .claude/agents/*.md
    - .claude/skills/* or skills/*
    - Any MEMORY.md, AGENTS.md, INSTRUCTIONS.md
[ ] For each file measure:
    - Size (KB + estimated tokens)
    - Language (flag non-English config files)
    - Last modification date
    - Cross-file duplication
    - Obsolete rules (references to absent files/tools)
[ ] Detect bloat signals:
    - CLAUDE.md > 10 KB
    - Subagent without pinned `model:`
    - Skill description > 200 tokens
    - More than 5 defined subagents
[ ] Produce a report BEFORE any modification.
```

---

## 3. CLAUDE.md — hygiene rules

### Density target

- **Hard ceiling**: 10 KB / ~2500 tokens. Beyond, the model ignores part of the content.
- **Anti-pattern**: rules describing already-natural behavior ("write readable code", "comment complex functions") — remove.
- **Anti-pattern**: rules added in reaction to a one-off incident and not reviewed in 30+ days — remove or revise.
- **Convert to hooks** anything mechanically verifiable (lint, format) rather than leaving it as prose instruction.

### Recommended structure

```markdown
# [Project]

## Stack
[2-5 lines max: languages, major frameworks, database]

## Mandatory conventions
[Rules Claude Code must follow without asking]

## Workflows
[Common commands: tests, build, deploy]

## Known pitfalls
[Counter-intuitive things specific to this project]

## Out of scope
[What Claude Code MUST NOT touch]
```

### Auto-prune

Each session where Claude Code modifies code, **passively verify** that CLAUDE.md rules still match the project state. Any obsolete rule must be flagged at end-of-turn with a removal proposal.

---

## 4. Subagents — frugality rules

### Concurrency

- **Default ceiling**: 3 parallel subagents max, unless explicitly requested.
- **Plan mode mandatory** before any wave (≥2 subagents). Present the plan to the user.
- **Relevance test**: if the result must return fully to the main context, do not use a subagent. Subagents filter noise, they don't relocate it.

### Model choice

- **Execution subagents** (search, read, simple refactor): Haiku or Sonnet — never Opus.
- **Explicit pinning** in `.claude/agents/<name>.md`:
  ```yaml
  ---
  name: explore-codebase
  description: Read-only code search, returns summary only.
  model: sonnet
  tools: [Read, Grep, Glob]
  ---
  ```
- If a subagent uses Opus, **justify in a comment** why Sonnet is insufficient.

### Subagent creation

Claude Code may **propose a new subagent** when observing a recurring pattern (3+ invocations of same nature in one session). Propose with name, role, pinned model, and restricted tools.

---

## 5. Session management — signals to emit proactively

Without being asked, Claude Code flags:

| Observed signal | Suggested action |
|-----------------|------------------|
| Context ≥ 60% | Propose targeted `/compact` or `/clear` + brief |
| Context ≥ 80% | Insist: compact/clear before next complex turn |
| 2 fixes on same bug | Propose `/rewind` rather than continue |
| Task switch detected | Propose `/clear` with handoff brief |
| File read 3rd time in session | Propose extracting to CLAUDE.md or skill |
| Subagent returning >5 KB result | Suggest refining the subagent prompt |

Flag ≠ execute. Final decision stays with user. But **do not wait passively** for the limit to be hit.

### Automatic handoff brief

Before any `/clear`, Claude Code automatically produces a 5-10 line brief:

```markdown
# Handoff — [date] [task]
**Context**: [1-2 lines on where we are]
**Decisions made**: [short list]
**Active files**: [paths]
**Next step**: [1 line]
**Identified pitfalls**: [if relevant]
```

User pastes this brief at the start of a new session to resume cleanly. Always produced **BEFORE the `/clear`**, never after.

---

## 6. Skills — rules

### Progressive disclosure

A well-built skill loads ~100 tokens of metadata. Content deploys only on invocation. If `description` exceeds 200 tokens, restructure.

### SKILL.md pattern

```markdown
---
name: skill-name
description: One sentence. When to activate this skill, period.
---

# Name

[Content deployed only on invocation]
```

### CLAUDE.md vs skill — partition rule

- **CLAUDE.md** = global rules, always active, all task types.
- **Skill** = specific workflow activated on a precise task type (write a test, deploy, process a PDF).

Operational criterion: if a CLAUDE.md rule applies to <30% of project tasks, move it to a skill.

---

## 7. Recommended workflow for long sessions

1. **Start**: new session = new task. 3-5 line brief on opening if resuming work.
2. **At 30% context**: light checkpoint, optional mental recap.
3. **At 60% context or focus change**: targeted `/compact "keep X and Y, drop Z"`.
4. **Task complete**: handoff brief + `/clear`. Do not chain unrelated tasks.
5. **2+ corrections in a loop**: `/rewind`, restart with a more precise prompt.

---

## 8. Project-level model configuration

If the repo has `.claude/settings.json` or equivalent, verify:

- **Default effort**: `high` (not `xhigh`) unless justified.
- **Max parallel subagents**: 3.
- **Auto-compact**: enabled (safety net — do not rely on it).

If absent and the project allows, propose to the user.

---

## 9. Self-improvement of this directive

Claude Code may edit this file when:
- A principle did not apply in practice → clarify or remove it.
- A new usage pattern emerges → add it.
- A rule becomes redundant with a native Claude Code feature → remove it.

**Guardrail**: this directive must stay under **9 KB**. If a modification pushes it over, remove a less useful rule in compensation.

On each modification, add a CHANGELOG line below.

---

## CHANGELOG

- 2026-05-03: Initial creation (English).
