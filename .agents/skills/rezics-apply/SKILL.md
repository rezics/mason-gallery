---
name: rezics-apply
description: Apply a code-first plan — route each durable item to its home in code (types/tests/comments), then make the source document disposable. No validation CLI, no state machine. Use when implementing a plan/proposal.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

Implement work whose durable knowledge must end up in **code**, not in a planning
document. This is the *routing* half of the workflow: `/rezics-propose` produces a
plan and tags its durable items; this skill lands those items in their natural
home and lets the source document become disposable.

It is deliberately thin — **no validation CLI, no state machine, no ceremony**. It
is a checklist you load at implement time, nothing more. Skills are loaded on
invocation, so this is also *where* the routing rule actually reaches the
implementer — a plan written in one session is applied in another, and the rule
must be in context then, not at propose time.

The source is a plan at `plan/proposal/<slug>.md` (items tagged
`(comment)/(test)/(type)`).

---

## The four-way routing rule

Triage every item — **per requirement, not per document** — into exactly one home:

| Item | Home |
|---|---|
| Shape, legal values, types, indexes | Types / Valibot / Prisma — drop the prose |
| Behavior under conditions (GIVEN/WHEN/THEN) | A test |
| Irreducible invariant / *why* / deliberate non-restriction / known staleness | A concise comment at the owning code |
| History, migration steps, rename maps | The git commit message — drop after landing |

The highest-value items are the **negative** ones — "no ancestry check", "no
domain restriction on `url`", "this cache may be stale for up to N s". Without them
a future dev "fixes" intended behavior. Capture these first.

Cross-cutting invariants live in the **owning** file's comment, with a one-line
back-pointer at each remote site. Only the genuinely scattered ones earn a short
`package/.../README.md` — a handful across the repo, not one per spec.

## Comment format — match the site, never invent one

The codebase already has conventions. A migrated comment adopts whichever fits its
target; it does not introduce a new style:

| What the comment documents | Format |
|---|---|
| An exported symbol (fn / type / env field / API route) | `/** … */` JSDoc |
| A local decision / branch / invariant inside a body | `// …` at that line |
| A named region spanning several lines | `// ANCHOR: …` (existing convention) |

Rules:

- Never wrap a one-line local "why" in JSDoc to look formal — use `//`.
- **Never leave a `spec.md` back-reference.** A comment like `// per foo/spec.md`
  must become the actual invariant inline — the spec is being deleted; the
  knowledge cannot point at a corpse.
- If a type already says it, say nothing. Prefer a concise comment to a verbose one.

## Steps

1. **Read the source** (plan or spec) and the code it constrains. Ground every
   item in the real files before moving it.
2. **Route each item** with the table above: land the types, write the tests,
   write the comments at the owning code.
3. **Verify** — run the package's tests and `task check:*` as relevant.
4. **Update plan progress.** Mark every completed `## Tasks` checkbox as
   `- [x]`. Leave unfinished or deliberately skipped work unchecked and call it
   out in the final response.
5. **Make the source disposable.** A plan: set `status: done` only when all
   task-owned work is complete or explicitly no longer applicable (a human
   deletes it later). History/migration prose goes into the commit message, not
   back into a file.

## Guardrails

- **Route per requirement, not per document** — a half-migrated spec is worse than
  an untouched one. Finish a spec atomically or leave it for later.
- Knowledge lands in code or it is dropped; never create a parallel spec corpus.
- **Do not invent behavior.** This is a migration of knowledge into code, not a
  refactor; if an item is ambiguous, ask rather than guess.
