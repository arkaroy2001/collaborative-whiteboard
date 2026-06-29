# Architecture Decision Records (ADRs)

This directory holds a record of significant architectural decisions made on this
project — what we decided, why, and what we traded away. The point is future-you
(and an interviewer) being able to reconstruct the reasoning, including the
options we rejected.

## When to write one

Write an ADR when a decision is non-trivial and hard to reverse, or when there
were 2+ reasonable approaches and we picked one. Examples for this project: the
CRDT algorithm choice, the persistence model (op log vs. snapshot), the wire
protocol shape, conflict-resolution semantics for move/delete.

Do NOT write one for routine or easily-reversed choices.

## Format

Each ADR is a numbered file: `001-short-name.md`, `002-short-name.md`, etc.
Numbers are sequential and never reused. Use this structure:

```markdown
# NNN. Short title

- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD

## Context

What's the situation? What forces are at play (requirements, constraints,
tradeoffs)? What options did we consider?

## Decision

What did we decide, and why this option over the alternatives?

## Consequences

What becomes easier or harder as a result? What do we now have to live with?
What did we give up? What follow-on work or risks does this create?
```
