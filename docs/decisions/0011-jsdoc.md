---
status: accepted
decision-makers: Team leads
---

# ADR-0011: Document JavaScript with JSDoc

## Context and Problem Statement

The codebase needs documentation that helps contributors understand and maintain the code and its shared interfaces. The use of AI-assisted development makes it especially important that authors understand what they submit, consistent with [ADR-0002](0002-ai-usage.md).

Nathan proposed JSDoc for code comprehension, IntelliSense, and automated documentation generation. Pengwei agreed to make it a shared coding standard and asked whether the project should use TypeScript. Nathan favored keeping JavaScript because the project had already undergone substantial changes, including removing React from the chart library; another migration would add work. Pengwei accepted using JSDoc type annotations with JavaScript tooling instead.

## Considered Options

- Migrate the existing codebase to TypeScript.
- Keep JavaScript and use JSDoc for documentation and type information.

## Decision Outcome

Keep the codebase in JavaScript and adopt JSDoc as a shared documentation standard, supporting static analysis, type checking, and automatically generated HTML documentation. The shared documentation requirements are maintained in [JSDoc conventions](../jsdoc.md).

### Consequences

- Good: contributors share a documentation standard that supports comprehension, review, editor assistance, and future generated reference documentation.
- Good: type information can support checking while retaining JavaScript and avoiding another source-language migration.
- Bad: contributors must add and maintain accurate annotations as behavior and interfaces change.
- Bad: additional tooling will be required for documentation generation and CI/CD type checking.
