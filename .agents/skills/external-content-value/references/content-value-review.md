# Content-value review

Use this reference when auditing existing content, resolving a borderline explanation, or changing several external surfaces.

## Exact test

An external content unit is unjustified when removing it, in its actual surface and for its intended audience, would not materially reduce the audience's ability to:

- identify or distinguish the subject;
- answer a real, evidence-based or domain-necessary question;
- complete a task or make an informed decision;
- understand a non-obvious state, consequence, scope, or constraint; or
- satisfy a safety, legal, accessibility, rights, provenance, or trust need.

The test applies to a whole unit of meaning, not merely its sentence. A sentence can contain both valuable and valueless clauses.

## Valid content jobs

| Job | Keep when | Typical examples |
| --- | --- | --- |
| Identify | The audience needs to recognize or distinguish the subject | A book's actual scope, an unambiguous control label |
| Act or decide | The information changes a task, choice, or next step | Eligibility, required input, available action |
| Predict consequences | A result is important and not already evident | Data loss, public visibility, notifications, irreversible changes |
| Understand scope or constraints | The audience might otherwise make a consequentially wrong assumption | Permission scope, inclusion rules, language fallback |
| Establish trust or duty | The content satisfies a real obligation or supports justified trust | Rights, provenance, safety, privacy, accessibility, attribution |

General product exposition, implementation explanation, and prose that merely sounds informative are not independent content jobs.

## Issue taxonomy

Use one or more of these labels during an audit:

- **N — No audience need:** no concrete audience task, question, decision, or obligation supports publication.
- **R — Redundant:** repeats a label, visible state, nearby sentence, or information already communicated by the structure.
- **T — Trivial or interface narration:** says that items appear here, describes the component presentation, or verbalizes an obvious interaction without helping the audience.
- **S — System-oriented:** describes data models, storage, identifiers, implementation mechanics, authoring operations, or team rationale instead of an audience-visible fact or consequence.
- **O — Over-communication:** contains some value but adds detail beyond what this audience needs at this point.
- **P — Misplaced:** useful content on the wrong surface or at the wrong level of detail.
- **U — Unsupported:** invents or infers facts, benefits, user misconceptions, or behavior that the available sources do not establish.

These labels diagnose the content; they are not phrase-matching rules.

## Disposition guide

| Finding | Disposition |
| --- | --- |
| Serves a valid job at the correct point | Keep; edit only for accuracy or clarity |
| Serves a valid job but uses system language | Rewrite around the audience-visible fact, outcome, or consequence |
| Needed only by some audiences or later in a task | Relocate to contextual help, progressive disclosure, or specialist documentation |
| Explains concepts rather than supporting the current action or reference lookup | Move to an explanation document when that need is real |
| Redundant, trivial, unsupported, or without an audience need | Remove |
| Exists only because a field is required | Make the field or rendering optional when possible; do not manufacture filler |

## REZICS examples

### Remove or rewrite

- `Added content will appear here using the same cards as the feed.` The empty state and component already communicate the location; the card implementation does not provide a next step.
- `New activity and system updates will appear here.` This restates an empty notifications view without changing what the user can do.
- Repeating `View and manage … related to your work` beneath every content-type label does not distinguish the choices. Give a type-specific distinction or omit the descriptions.
- `The relative order of selected items is preserved and the change is applied atomically.` Preserve the user-visible ordering consequence; remove `applied atomically` unless the audience must act differently because of it.
- A public book summary that explains reusing `Book`, `Post`, or `book.contents` records describes authoring and data modeling, not the book. Publish sourced bibliographic scope instead, or leave optional metadata absent.

### Keep

- `The collection and its arrangement cannot be restored after deletion.` This supports an irreversible decision.
- Explaining the exact language fallback order beside a language-order setting helps users predict what content they will see.
- Security, privacy, licensing, governance, and administrative copy may need precise specialist detail when it changes authority, risk, auditability, or recovery.

## Audit record

For a deliberate audit, record enough context to review decisions consistently:

| Surface | Audience | User need | Original content | New information | Issue | Disposition | Proposed result |
| --- | --- | --- | --- | --- | --- | --- | --- |

Do not assign a numeric quality score. A count of words or flagged phrases cannot establish whether information has value.

## Review practice

- Review content in the consuming context, including labels, controls, layout hierarchy, and preceding or following messages.
- Use a second reviewer for broad audits or consequential public content. The reviewer should challenge the stated need, not merely proofread the wording.
- Treat automated searches for phrases such as `will appear here`, `this page`, `not`, `used to`, or internal type names as inventory aids only.
- Split cleanup by owning surface so each change can preserve local behavior, terminology, and verification.

## Foundations

- [GOV.UK: Identify user needs](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/plan-manage-content/identify-user-needs/)
- [CMS: Guidelines for effective writing](https://www.cms.gov/training-education/learn/find-tools-to-help-you-help-others/guidelines-for-effective-writing)
- [Microsoft: User Interface Text](https://learn.microsoft.com/en-us/windows/win32/uxguide/text-ui)
- [Nielsen Norman Group: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Microsoft: Progressive Disclosure Controls](https://learn.microsoft.com/en-us/windows/win32/uxguide/ctrl-progressive-disclosure-controls)
- [Diataxis documentation framework](https://diataxis.fr/)
