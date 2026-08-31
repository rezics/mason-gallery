---
name: typesafe
description: "Use when designing, implementing, debugging, migrating, or reviewing typed code and data contracts, especially around external inputs, state transitions, schemas, generated types, storage, or unsafe conversions. Apply across languages by matching every type guarantee to what the project's compiler, analyzer, schemas, and runtime checks actually prove."
metadata:
  version: "1.1.0"
---

# TypeSafe

Use types and contracts to prevent meaningful mistakes, not to maximize type precision or
ceremony.

A **type guarantee** is a fact that code may safely rely on. Its proof may come from checked
construction, a compiler or analyzer, a runtime parser, an authoritative schema, or another
explicitly trusted source.

> Never let a type or contract promise more than its proof establishes. Keep that guarantee
> intact from its origin to its final use.

## Know the checking model

Before strengthening a contract, inspect the language and tool versions, checking settings,
generated bindings, schemas, validators, and foreign interfaces on the affected path.

- A compiler or analyzer carries only the facts supported by its model, configuration, and
  checked inputs.
- A runtime check proves only the conditions it tests, for the value that passed through it.
- A schema proves a data form, not the domain meaning assigned to that data.
- A test provides evidence for observed executions; it does not create a universal type proof.
- Gradual, optional, and unsound type systems contain escape hatches even when all checks pass.

At important points, keep six things aligned: the value's meaning, runtime value, type or
contract, data form, allowed operations, and proof.

## Model what changes behavior

Represent the values, states, failures, and transitions that make callers behave differently.

- Keep distinct meanings distinct even when they share a representation.
- Make an invalid state unrepresentable when doing so prevents a realistic mistake.
- Show expected absence and failure when callers must handle them.
- Ask for only the input facts an operation needs and promise only the output facts it makes
  true.
- Prefer constructions and interfaces that preserve invariants over comments or repeated
  checks.
- Make matches and state transitions exhaustive where the checking model can enforce that.

Judge a contract by the bad operations it prevents. A wider type can lose a fact; an overly
precise type can add friction without preventing any failure. Use the weakest contract that is
strong enough to make the required operations safe.

## Strengthen guarantees only with proof

Strengthen a type through checked construction, derivation from already proved facts, a runtime
parse, or another identified source of truth.

Treat external and cross-boundary data as unproved until checked. This includes user input,
network and IPC payloads, files, configuration, environment values, database results, cached or
queued data, foreign code, and data written by another version.

Prefer parsing that returns a refined value over validation that discards what it learned. Once
the boundary accepts a value, downstream code should receive the proved representation rather
than the original loose form.

Treat casts, assertions, ignored diagnostics, caller-selected generics, handwritten guards, and
foreign declarations as claims that still need evidence. If an escape hatch is necessary, keep
it at the smallest boundary, explain its proof and limits, and return immediately to an honest
contract.

Derive types from authoritative schemas or definitions when practical. If duplication is
unavoidable, add a check that detects drift.

## Preserve the guarantee end to end

Follow each changed guarantee through transformations, calls, serialization, storage, queues,
caches, processes, versions, asynchronous work, and mutable state to its final effect.

- Carry absence, failure, and state changes as carefully as success.
- Preserve semantic distinctions instead of flattening them into convenient primitives.
- Re-establish proof after a trust, process, version, representation, time, or mutation boundary
  invalidates the old proof.
- Consume the value according to the guarantee that actually arrives. Do not rebuild a lost
  guarantee with an unchecked assertion.
- If the final operation needs a stronger fact, obtain that fact at the earliest boundary that
  can prove it without duplicating checks.

End-to-end safety requires a correct origin, complete propagation, and correct consumption. A
strong local type does not repair a broken boundary, and a checked boundary does not make an
incorrect final operation safe.

## Verify proportionately

Use the checks that correspond to the facts changed:

- compiler, analyzer, and type tests for static relationships;
- runtime parsers and contract tests for boundary facts;
- behavior tests for operational rules outside the type system;
- serialization, persistence, compatibility, and version tests for data-form boundaries.

Trace the changed guarantee from its first proof to its final use. State any invariant that
remains assumed, and make the safety claim no stronger than the evidence supports.
