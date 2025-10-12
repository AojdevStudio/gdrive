# Code Quality Protocol

## DRY Principle

- Don't Repeat Yourself - eliminate code duplication
- Extract common patterns into reusable modules
- Use functions, classes, or methods for repeated logic

## SOLID Principles

- **S**ingle Responsibility: One reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes must be substitutable
- **I**nterface Segregation: Many specific interfaces
- **D**ependency Inversion: Depend on abstractions

## Code Style

- Consistent naming conventions (camelCase for JS/TS, snake_case for Python)
- Clear, self-documenting variable names
- Functions should do one thing well
- Keep functions under 20 lines when possible
- Classes under 200 lines

## Comments & Documentation

- Code should be self-documenting
- Comments explain "why", not "what"
- Update comments when code changes
- Remove dead code, don't comment it out

## Error Handling

- Fail fast with clear error messages
- Use proper error types/classes
- Handle errors at appropriate levels
- Never silently swallow errors

## Performance

- Optimize for readability first
- Profile before optimizing
- Use appropriate data structures
- Avoid premature optimization
