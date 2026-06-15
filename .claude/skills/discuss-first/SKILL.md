---
name: discuss-first
description: Discuss and get approval before edits for ambiguous, architectural, or multi-file changes.
---

# Discuss-First Workflow

## Core Rule

**Do not modify, create, or delete any file until the user explicitly approves the proposal.**

---

## Phase 1 — Analyze & Propose

1. Read all relevant files to fully understand the current state.
2. Output a structured proposal using the template below.
3. End with a clear approval prompt — do not proceed until the user responds.

### Proposal Template

```
## Proposal

**Goal**
<One or two sentences: what problem this solves or what the user asked for.>

**Approach**
<Step-by-step plan. Be specific — name functions, files, patterns.>
1. ...
2. ...
3. ...

**Files Affected**
| File            | Change                              |
| --------------- | ----------------------------------- |
| path/to/file.ts | modify — describe what changes      |
| path/to/new.ts  | create  — describe what it contains |
| path/to/old.ts  | delete  — reason                    |

**Trade-offs / Risks**
<Anything the user should decide: alternative approaches, potential breakage,
assumptions you're making, out-of-scope items you noticed.>

---
Does this look right? Say **yes** to proceed, or let me know what to adjust.
```

---

## Phase 2 — Wait for Approval

| User response                                | Action                                      |
| -------------------------------------------- | ------------------------------------------- |
| "yes", "go", "proceed", "lgtm", "looks good" | Enter Phase 3                               |
| Requests changes                             | Update the proposal, re-present, wait again |
| "no", "cancel", "stop"                       | Halt. Make no changes.                      |
| Ambiguous                                    | Ask for clarification before doing anything |

---

## Phase 3 — Execute

- Follow the approved plan exactly.
- If you encounter something **outside the approved scope** (unexpected dependency, hidden complexity, a file you didn't list), **pause and report** before continuing:
  > "I found [X] which wasn't in the original plan. Should I [proposed adjustment], or would you like to revise the proposal first?"
- After completing all changes, output an **Execution Summary**:

```
## Done

**Changes made:**
- `path/to/file.ts` — <what was changed>
- `path/to/new.ts`  — <what was created>

**Anything to follow up:**
- <tests to run, migrations to apply, env vars to set, etc.>
```

---

## Quick Reference

```
Phase 1  →  Read → Propose → Ask for approval
Phase 2  →  Wait (no edits)
Phase 3  →  Execute exactly what was approved → Summarize
```

**Scope creep rule:** When in doubt, surface it — never silently expand the plan.
