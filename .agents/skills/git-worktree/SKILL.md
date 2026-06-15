---
name: git-worktree
description: Create and integrate Rezics worktrees using the main/archive workflow.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

# Git Worktree Skill

Use this skill for branch and worktree lifecycle in Rezics: create, list,
integrate, and clean up linked worktrees while preserving completed branch
history under `archive/*`.

## Routing

Use this skill for worktree lifecycle operations.

When a worktree needs an ordinary task-branch commit, delegate message
generation to `git-commit`. When a completed branch is ready to enter `main`,
delegate the final squash message to `git-mainline-squash`.

## Modes

Detect the user's intent from their phrasing and repo state.

| Mode | Triggers |
| --- | --- |
| `create` | "create worktree", "new worktree", "spin up parallel branch" |
| `integrate` | "merge worktree back", "integrate worktree", "archive and land this branch" |
| `cleanup` | "remove worktree", "clean up worktree", "delete old worktree" |
| `list` | "list worktrees", ambiguous requests, or no clear verb |

If ambiguous, run `git worktree list` first and ask which mode the user wants.

## Mode: create

### Step 1 - Resolve the start point

Default start point is the current `main` baseline:

```bash
git fetch origin main
git rev-parse origin/main
git branch --show-current
git status --short
git log --oneline -3 origin/main
```

Prefer `origin/main` as the start commit. Use local `main` only after confirming
it is fast-forwarded to `origin/main`. If the user asks to branch from local
`HEAD`, a SHA, or another branch, resolve it and ask for explicit confirmation.

Warn, but do not block, if the current working tree is dirty. Uncommitted changes
stay in the current worktree and will not appear in the new one.

If the current process is inside a linked worktree, say so and confirm whether
the new worktree should start from `origin/main` or this linked worktree's HEAD.

### Step 2 - Propose path and branch name

Suggest:

- Path: `../<repo-name>-<slug>`
- Branch: one of `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`,
  `spike/<topic>`, or `<owner>/<topic>`

Do not suggest `feature/*` or `experiment/*`; Rezics uses `feat/*` and
`spike/*`.

Example:

```text
Suggested:
- Path:   ../rezics-crawler-preview-routing
- Branch: feat/crawler-preview-routing
- Start:  <short-sha> (origin/main)
```

Wait for approval before creating anything. If the path or branch already
exists, surface that and offer a different name; never overwrite silently.

### Step 3 - Create the worktree

After approval:

```bash
git worktree add <path> -b <branch> <start-commit>
```

Always pass the resolved start commit explicitly. If the command fails, surface
the error and stop.

### Step 4 - Handoff

Print the absolute path and exact command for a new terminal:

```bash
cd <absolute-path>
codex
```

Then run:

```bash
git worktree list
```

Do not pretend to move the current session into the new worktree.

## Mode: integrate

This mode lands a completed task branch into `main` as one coherent squash commit
and preserves detailed branch history under `archive/*`.

### Step 1 - Identify the worktree and branch

Run:

```bash
git worktree list --porcelain
```

Resolve the target worktree path and branch. If the user named only a topic,
match it against worktree paths and branch names. Ask if more than one match is
possible.

### Step 2 - Preflight

Inside the target worktree, run:

```bash
git -C <worktree-path> fetch origin main
git -C <worktree-path> status --short
git -C <worktree-path> branch --show-current
git -C <worktree-path> merge-base origin/main HEAD
git -C <worktree-path> rev-parse HEAD
git -C <worktree-path> log --oneline origin/main..HEAD
```

Requirements:

- Working tree must be clean. If not, stop and suggest `git-commit` for staged
  changes or ask the user to resolve unstaged changes.
- Branch must have commits ahead of `origin/main`.
- Branch must be a task branch or owner branch. If it is `main`, `release/*`,
  `stable/*`, `archive/*`, or `backup/*`, stop unless the user explicitly
  explains the unusual integration.

Record:

- `Feature-base`: merge-base with `origin/main`, unless the maintainer provides a
  more precise recorded base
- `Archive-tip`: final branch tip after any requested rebase
- `Original-branch`: current task branch

### Step 3 - Update against main

Default strategy is rebase onto the current mainline before archiving:

```bash
git -C <worktree-path> fetch origin main
git -C <worktree-path> rebase origin/main
```

Before rebasing a branch that has been pushed or shared, warn that rebase
rewrites branch history and ask for confirmation. If the maintainer asks for a
merge-based update instead, follow that explicit instruction and record the
actual final tip.

If conflicts occur, stop and report the conflicted files. Do not auto-resolve or
continue until the user says the conflict is handled.

After a successful rebase, refresh:

```bash
git -C <worktree-path> rev-parse HEAD
```

Use that SHA as `Archive-tip`.

### Step 4 - Create and push the archive ref

Derive the archive branch:

```text
archive/YYMMDD-<type>-<topic>
```

Examples:

```text
archive/260606-feat-crawler-preview-routing
archive/260606-refactor-post-ranking
```

Show the proposed archive ref and ask for approval. Then create/push it:

```bash
git -C <worktree-path> branch <archive-ref> <archive-tip>
git -C <worktree-path> push origin <archive-ref>
```

If the archive branch already exists, stop and ask whether to choose a different
name or verify that it already points to the intended tip. Never force-update an
archive branch without explicit force approval.

Remote Git does not preserve a portable branch-rename event. What matters is
that the remote archive ref points at the preserved history.

### Step 5 - Squash onto main

In the main worktree, or in a clean worktree where `main` can be checked out:

```bash
git switch main
git pull --ff-only origin main
git merge --squash <archive-tip>
```

Use `git-mainline-squash` to generate the commit message with:

- `Archive-ref`
- `Archive-tip`
- `Feature-base`
- `Original-branch`
- optional `Pull-request`

Ask for explicit confirmation before running `git commit`.

If `git merge --squash` conflicts, stop and report conflicts. Do not create a
partial commit until the user resolves or aborts the merge.

### Step 6 - Push main and cleanup offer

After the squash commit exists locally, ask before pushing:

```bash
git push origin main
```

After the archive ref exists remotely and `main` has the squash commit, offer
cleanup. Do not auto-run cleanup:

```bash
git worktree remove <worktree-path>
git branch -d <original-branch>
git push origin --delete <original-branch>
```

Only delete the remote active branch if it was pushed and the user confirms.
Never delete `archive/*`.

## Mode: cleanup

Run:

```bash
git worktree list --porcelain
```

Resolve the target worktree and branch. Before removal:

```bash
git -C <worktree-path> status --short
```

If dirty, stop and ask. If clean, ask which cleanup actions to run:

```bash
git worktree remove <worktree-path>
git branch -d <branch>
git push origin --delete <branch>
git worktree prune
```

Never use `--force`, `branch -D`, or remote branch deletion without explicit
confirmation for that exact branch in this session.

## Mode: list

Run:

```bash
git worktree list
git worktree list --porcelain
```

Annotate entries with branch name, clean/dirty state, last commit subject, and
whether the branch appears ahead of `origin/main`.

## Safety Rules

- Never delete or force-update `archive/*`.
- Never run `git worktree remove --force`, `git branch -D`, `git push --force`,
  or `git push origin --delete` without explicit confirmation.
- Never silently switch the integration target away from `main`.
- Always show the exact command before create, integrate, remove, push, or delete
  operations.
- If `.git/MERGE_HEAD`, `.git/REBASE_HEAD`, or another in-progress Git operation
  is detected, stop until it is resolved.
- Prefer pausing and asking over auto-recovery when a Git command fails.

## Quick Reference

```bash
# Create
git fetch origin main
git worktree add <path> -b <branch> <start-commit>

# Archive completed branch
git -C <wt> fetch origin main
git -C <wt> rebase origin/main
git -C <wt> branch <archive-ref> <archive-tip>
git -C <wt> push origin <archive-ref>

# Squash onto main
git switch main
git pull --ff-only origin main
git merge --squash <archive-tip>
# use git-mainline-squash, then commit
git push origin main

# Cleanup
git worktree remove <path>
git branch -d <branch>
git push origin --delete <branch>
```
