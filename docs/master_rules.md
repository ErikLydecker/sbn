# Master Rules

This document defines **non-negotiable architectural and implementation rules** for this codebase.  
All decisions, implementations, and refactors must comply with these rules.  
If something conflicts with these rules, **the rules win**.

---

## 1. Single Source of Truth (SSOT)

- Every piece of information may exist in **one and only one place**.
- There must never be duplicate representations of the same state, configuration, or data.
- Derived data must be **derived**, never stored.
- If two places need the same information, one owns it and the other consumes it.

**Anti-patterns:**
- Duplicated state in local component state and global store
- Copying server data into multiple stores
- Repeating constants across files

**Rule:**
> There can only ever be one truth.

---

## 2. Strong Separation of Concerns

Each layer has exactly one responsibility.

### UI Layer
- Responsible only for rendering and user interaction
- No business logic
- No data fetching
- No state orchestration
- No side effects

### State Layer
- Owns application state and transitions
- No UI knowledge
- No rendering logic

### Domain / Logic Layer
- Owns business rules and invariants
- Stateless where possible
- Deterministic and testable

### Infrastructure Layer
- APIs, persistence, adapters, integrations
- No business decisions

**Rule:**
> If a file does more than one thing, it is doing too much.

---

## 3. Modular Design

- Every module must be:
  - Self-contained
  - Predictable
  - Replaceable
- Modules communicate only through explicit interfaces.
- No hidden coupling through imports, globals, or side effects.

**Good modules:**
- Can be moved without breaking unrelated code
- Have clear inputs and outputs
- Do not reach into other modules’ internals

---

## 4. No Hardcoding

- No hardcoded:
  - Values
  - IDs
  - Strings
  - Sizes
  - Layout numbers
  - Feature flags
- All values must come from:
  - Configuration
  - Constants
  - Schemas
  - State

**Rule:**
> If a value might ever change, it must not be hardcoded.

---

## 5. No Inline Styling

- No inline styles
- No style objects in components
- Styling must be:
  - Token-based
  - Class-based
  - Centralized

**Reason:**
- Inline styles bypass design systems
- Inline styles break consistency
- Inline styles are not scalable

---

## 6. No Inline Components

- No component definitions inside other components
- No anonymous JSX logic blocks acting as components

**Why:**
- Causes unnecessary re-renders
- Breaks memoization
- Makes debugging harder
- Hides responsibilities

**Rule:**
> Every component must live in its own file and have a name.

---

## 7. Reusable by Default

- Components must be reusable unless explicitly proven otherwise.
- Components should:
  - Accept data via props
  - Avoid assumptions about context
  - Avoid hardcoded behavior

If a component is not reusable:
- Document why
- Restrict it intentionally

---

## 8. Logical Direction of Flow

Data and control flow must always be **unidirectional**.

### Flow direction:
- Input → State → Logic → Output
- User Action → Event → State Transition → Render

**Forbidden:**
- Circular dependencies
- UI mutating state indirectly
- Side effects triggered during render

**Rule:**
> Nothing should ever feel “magical”.

---

## 9. Explicit State Machines

- All complex state must be modeled explicitly.
- States must be finite and named.
- Transitions must be explicit and deterministic.

**State machines must define:**
- Valid states
- Valid transitions
- Invalid transitions (and how they are prevented)

**Benefits:**
- Prevents impossible states
- Prevents race conditions
- Makes logic debuggable

---

## 10. Race Condition Avoidance

- All async logic must be:
  - Cancellable
  - Idempotent where possible
  - Scoped to lifecycle
- Never assume execution order.
- Never rely on timing.

**Rules:**
- No shared mutable async state
- No overlapping requests without coordination
- No effects that depend on stale closures

---

## 11. Render Discipline

- Avoid unnecessary re-renders.
- Components must render only when their inputs change.
- Memoization is a tool, not a crutch.

**Rules:**
- Stable references
- No derived data inside render if it can be computed earlier
- No side effects in render

---

## 12. Predictable State Ownership

- Each piece of state has exactly one owner.
- Ownership hierarchy must be obvious.
- Passing state downward is preferred.
- Pulling state upward is deliberate.

**Never:**
- Mutate state outside its owner
- Mirror state across layers

---

## 13. Validation at Boundaries

- Validate data at system boundaries.
- Never trust:
  - User input
  - API responses
  - External systems

Schemas must:
- Be centralized
- Be reusable
- Define invariants clearly

---

## 14. No Hidden Side Effects

- Side effects must be:
  - Explicit
  - Isolated
  - Predictable
- No side effects during render.
- No side effects hidden inside utility functions.

---

## 15. Determinism Over Convenience

- The same input must always produce the same output.
- Avoid randomness unless explicitly required.
- Avoid time-based logic unless explicitly modeled.

---

## 16. Explicit Errors, Never Silent Failures

- Errors must be:
  - Visible
  - Traceable
  - Actionable
- Never swallow errors.
- Never fail silently.

---

## 17. Naming Is Architecture

- Names must describe intent, not implementation.
- Avoid vague names.
- Avoid abbreviations unless universally obvious.

Bad names hide bugs.  
Good names prevent them.

---

## 18. Scalability Is a First-Class Concern

- Design for:
  - Growth
  - Change
  - Replacement
- Avoid cleverness.
- Favor clarity over brevity.

---

## 19. No Exceptions Without Documentation

If a rule must be broken:
- Document why
- Document alternatives considered
- Document why this is safe

No undocumented exceptions.

---

## 20. The Prime Directive

> **Clarity beats cleverness.  
Predictability beats shortcuts.  
One truth beats convenience.**

If something feels confusing, it is wrong.