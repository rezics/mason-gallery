---
name: rezics-propose
description: Propose a code-first plan — a single markdown file with context, durable constraints/decisions, and a task checklist. No spec files. Use when the user wants to turn an idea into actionable, implementable work.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

Produce one executable plan at `plan/proposal/<slug>.md`. **No spec files. No
validation CLI.** A plan is a disposable scaffold: when its work
lands, its durable content has migrated into code/comments/tests and the plan can
be deleted (a human deletes it; you do not, unless told).

This project is **code-first**. A plan's job is to carry only what code cannot yet
carry: the work to do, and the constraints/decisions the implementer must honor —
the same constraints that will become comments and tests at apply time.

---

## Steps

1. **Get the request.** If unclear, use **AskUserQuestion** to ask what they want
   to build or fix. Derive a kebab-case slug (e.g. "add poll voting" → `add-poll-voting`).
   Do not proceed without understanding the goal.

2. **Ground in the codebase.** Read the relevant domains before writing. Identify
   the files that will change and the existing patterns to match
   (`{domain}.api.ts/.service.ts/.mapper.ts/.types.ts`; contracts in
   `@rezics/contract`; frontend API in `@rezics/api`). A plan written without
   reading the code is a guess.

3. **Write `plan/proposal/<slug>.md`** using the structure below. If a file with
   that slug exists, ask whether to continue it or pick a new slug.

4. **Summarize**: slug, location, and the task count, then "ready to implement —
   ask me to start, or run `/rezics-apply`." Implementation is ordinary coding
   against the tasks; `/rezics-apply` carries the routing rule that lands each
   durable item in code. There is still no apply CLI and no state machine.

## Plan file structure

```markdown
---
title: <Human title>
status: active        # draft while shaping; active once ready to implement
created: <YYYY-MM-DD>
completed:
supersededBy:
tags: [<domain>, ...]
---

## Why
One or two paragraphs: the problem and the intended outcome. Not a spec — just
enough for an implementer (or future you) to know what this is for.

## Durable constraints & decisions
The non-obvious rules the implementation must honor — invariants, deliberate
non-restrictions, known tradeoffs, "do X not Y" boundaries. **These are the
items that must become code comments and tests at apply time.** Mark each with
its target home:
- `(comment)` an invariant/why that a type can't express
- `(test)` a behavior to lock with a test
- `(type)` a shape/value-set that the schema/types will carry — no prose needed long-term

## Tasks
- [ ] 1.1 <concrete, file-level step>
- [ ] 1.2 ...
Group with `## N. <phase>` headings when the work has phases.
These checkboxes are apply-time progress markers: `/rezics-apply` must mark
completed items as `- [x]` and leave unfinished or skipped items unchecked.

## Out of scope
What this plan deliberately does not do.
```

## At apply time

The `(comment)/(test)/(type)` marks above are routing hints for `/rezics-apply`,
which owns the four-way routing rule (shape → types, behavior → test,
invariant/why → comment, history → commit message) and the comment-format
conventions. **Propose only *tags*; apply *routes*** — deciding a comment's exact
form needs the target site in view, which only happens at apply. When the work
lands, apply marks completed task checkboxes and sets `status: done` only if all
task-owned work is complete or explicitly no longer applicable (a human deletes
it later).

## Guardrails

- **Never create spec files or a parallel spec corpus.** This workflow has no specs.
- **Read before writing** — ground the plan in real files and patterns.
- Keep the plan tight: tasks must be concrete and file-level; constraints must be
  the non-obvious ones, not a restatement of the types.
- Prefer reasonable decisions to keep momentum; only ask the user when a choice
  genuinely changes the work.
- **Do not implement** from this skill — proposing produces the plan; implementing
  is a separate step.
