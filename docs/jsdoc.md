# JSDoc conventions

These are the shared documentation requirements for the JavaScript codebase, established in [ADR-0011](decisions/0011-jsdoc.md).

JSDoc comments are required for all exported functions and classes, nontrivial internal functions, shared data structures, and important interfaces between components or modules.

Each documented function must include a brief description of its purpose and any non-obvious behaviour, along with the following tags as applicable:

- **@param**: Required for every parameter, including its type, name, and description.
- **@returns**: Required for functions that return a value, including the return type and description.
- **@throws**: Required for errors that callers are expected to handle.
- **@typedef**: Used to define reusable custom types, including object structures and type aliases.
- **@property**: Required to describe properties in object types defined using `@typedef`.
- **@type**: Used to specify the type of a variable, constant, or object where it cannot be adequately inferred.

Additional tags such as `@example` are encouraged when they improve understanding, but are not mandatory. See the [tag documentation](https://jsdoc.app/).

Type annotations should be accurate and specific, including optional and nullable values as appropriate. Prefer reusable `@typedef` definitions over repeated complex object types.

Documentation should explain important assumptions, limitations, side effects, and edge cases. It should ***not*** simply restate the process of the code, what variable names show, or what the code otherwise already makes obvious. Existing documentation must be updated when behaviour changes.

For syntax and examples, a guide has been created in Slack under `#guides`.
