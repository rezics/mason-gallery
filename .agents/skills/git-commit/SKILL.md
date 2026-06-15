---
name: git-commit
description: Create ordinary task-branch commits; use git-mainline-squash for final archive squashes.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

# Git Commit Message Skill

Use this skill for ordinary commits on task branches. It creates conventional
commit messages from staged changes, while using fresh task context when the
agent already knows what changed.

## Routing

Use this skill for:

- Normal local commits on `feat/*`, `fix/*`, `refactor/*`, `spike/*`, or
  owner-owned task branches
- Intentional task-branch commits made before final integration
- Documentation, tooling, test, and refactor commits that are not final mainline
  archive squashes

Do not use this skill for the final commit that lands a completed branch on
`main` with `Archive-ref`, `Archive-tip`, or `Feature-base` trailers. Use
`git-mainline-squash` for that.

## Workflow

### Step 1 - Check staged changes

Run:

```bash
git status --short
git diff --cached --stat
```

- If nothing is staged, warn the user and stop.
- If unrelated staged files are visible, stop and ask the user to stage only the
  intended files or confirm the intended scope.
- If staged files match the current task, proceed.

### Step 2 - Choose inspection level

Pick the lightest inspection level that is still defensible.

| Level | Use when | Commands |
| --- | --- | --- |
| 1 - staged file verification | The agent made the changes in this session and the staged files match the known task | `git diff --cached --stat` |
| 2 - targeted diff | Some staged files are uncertain, user changed files in parallel, or only part of the change is known | `git diff --cached -- <path>...` |
| 3 - full diff | No fresh context, many concerns, merge/rebase state, unexpected files, or any uncertainty about behavior | `git diff --cached` |

Fresh context is valid only when the agent has just performed or reviewed the
task in this conversation. Stale summaries are not enough.

Never skip staged file verification. A full diff is always acceptable when the
change is risky or unclear.

### Step 3 - Check in-progress Git operations

Run lightweight checks as needed:

```bash
cat .git/MERGE_HEAD 2>/dev/null
cat .git/REBASE_HEAD 2>/dev/null
```

If a merge is in progress, generate a merge commit message instead. If a rebase
is in progress, do not commit unless the user explicitly asks to continue the
rebase flow.

### Step 4 - Assess commit scope

Use the staged files, selected diff inspection, and task context to decide
whether the staged set is one coherent commit.

If the staged changes cover unrelated concerns, suggest a split and stop until
the user confirms the single-commit scope or restages files.

### Step 5 - Detect commit type

Pick the type that best represents the primary intent:

| Type | Signals |
| --- | --- |
| `feat` | New functions, routes, UI components, or capabilities |
| `fix` | Corrects broken behavior, error handling, null checks, race fixes |
| `refactor` | Renames, restructuring, extractions with no intended behavior change |
| `test` | Test files, mocks, fixtures, coverage changes |
| `docs` | Markdown, docs, comments, or copy that documents behavior |
| `chore` | Dependencies, config, build scripts, repo tooling |
| `style` | Formatting or whitespace only |
| `perf` | Caching, query, or algorithm improvements |
| `ci` | CI workflow and automation changes |
| `build` | Build system or packaging changes |

If uncertain between two types, pick the primary user-visible or maintainer
intent. Invite a user override without blocking.

### Step 6 - Generate the message

Format:

```text
<type>(<optional scope>): <subject>

- <body bullet: high-level why or what changed>
- <body bullet: ...>
```

Subject rules:

- Lowercase after the type prefix
- No trailing period
- Prefer 50 characters or fewer
- Specific enough to identify the change in history

Body rules:

- Omit the body for tiny obvious changes.
- Use 1-4 bullets for non-trivial changes.
- Keep body bullets contiguous; do not insert blank lines between list items.
- Prefer why and durable outcome over line-by-line implementation detail.
- Do not append archive trailers, co-authorship, attribution, or AI-generated
  trailers.

### Step 7 - Ask before committing

Show the final message in a fenced block and ask whether to commit or modify it.

Only run `git commit` after explicit user confirmation in this session.

When using `git commit -m`, pass the entire multi-line body as one argument.
Do not pass each bullet as a separate `-m`; Git treats each `-m` argument as a
separate paragraph and inserts blank lines between them. Prefer a commit message
file with `git commit -F <file>` for multi-line bodies when quoting is awkward.

When committing from the CLI, stage only task-owned files by explicit path if
staging is still needed. Never use `git add -A` or `git add .`.

## Merge Commits

If a merge commit is required:

```text
merge(<branch>): merge <source-branch> into <target-branch>

- Resolved conflicts in: <files if any>
- <notable integration note if any>
```

Keep it factual. Do not over-explain standard merges.

## Edge Cases

| Situation | Action |
| --- | --- |
| Nothing staged | Warn and stop |
| Staged files do not match known task | Stop and ask |
| Agent has fresh context | Verify staged files, then use targeted or no diff as appropriate |
| No fresh context | Inspect the full staged diff |
| Huge or unrelated diff | Suggest splitting |
| Only formatting | Use `style` |
| Only comments/docs | Use `docs` |
| Final archive squash | Use `git-mainline-squash` |
