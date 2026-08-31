---
name: external-content-value
description: Audit, write, or revise REZICS user-visible and externally published content so every text unit serves an audience need. Use for UI and localization copy, empty/help/error states, notifications and email, SEO or public metadata, seeded or showcase catalog content, and public API or user documentation. Do not use for internal logs, code comments, tests, or maintainer-only documentation unless their audience value is explicitly under review.
metadata:
  version: "1.0.0"
---

# External Content Value

## Goal

Publish content because an intended audience needs it, not because a field, component, schema, or source artifact offers a place to put text. Explanation is valid when it improves a real task, decision, or necessary understanding on the correct surface.

## Required workflow

1. Inspect the consuming component, document, API surface, or publication context together with nearby text. Do not judge an isolated locale key or source string.
2. Name the audience, its need at that point, and the new information or action the content provides.
3. Run the subtraction test: determine what the audience would lose if the text were removed. If the answer is nothing material, omit it.
4. Choose one disposition for each questionable unit: keep, rewrite around the audience-visible outcome, relocate to progressive disclosure or the correct documentation type, or remove.
5. Preserve necessary warnings, consequences, scope, constraints, rights, provenance, accessibility guidance, and operator detail. Specialized terminology is appropriate when the intended specialized audience needs it.
6. Verify the result in its surrounding content. When locale resources change, keep every locale natural and complete under the repository localization policy.

## Detailed review

For audits, ambiguous cases, or multi-surface changes, read [the content-value review reference](references/content-value-review.md) before deciding.

## Boundaries

- Do not ban words, negation, explanatory sentences, or internal terms mechanically. They are candidate signals, not failures.
- Do not invent user needs, misconceptions, bibliographic facts, benefits, or product behavior to justify or replace weak copy.
- Prefer absent optional content to filler. If a type or component requires valueless text, treat that requirement as a content-model problem and change it when the task permits; otherwise report the constraint.
- Keep implementation rationale in code comments or maintainer documentation unless the implementation creates a consequence the external audience must understand.
- Treat destructive, irreversible, security-sensitive, privacy-sensitive, governance, and rights-related surfaces as high-context cases; concision must not hide material consequences.

## Verification

- Inspect all call sites for a shared string before deleting or narrowing it.
- Run the nearest deterministic localization, type, or content checks required by the affected owner.
- Do not claim frontend acceptance from code review alone, and do not start visual browser QA unless the user explicitly requests it.
