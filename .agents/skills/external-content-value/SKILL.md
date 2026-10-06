---
name: external-content-value
description: Write or review Mason Gallery UI copy, localization, website text, and public documentation. Use when changing audience-facing wording; exclude internal logs and maintainer documentation.
metadata:
  version: "1.1.0"
---

# External Content Value

Keep text that helps the audience identify something, act, decide, or understand a non-obvious state or consequence. Omit optional text when removing it would lose nothing useful.

Judge wording in its consuming component or document, including nearby labels and controls. For shared strings, consider every call site before narrowing or removing them.

Prefer the audience-visible outcome over implementation detail. Move explanations needed only occasionally into contextual help or relevant documentation. Preserve material consequences such as data loss, privacy, permissions, and recovery limits; do not invent product behavior to justify copy.

For localization changes, preserve keys and placeholders across supported locales and write natural wording in each language. Verify the changed content in context with checks suited to the affected surface.
