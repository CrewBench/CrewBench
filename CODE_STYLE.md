Here you go, brother 👊
**Pure copy-paste Markdown**, no extra talk. Save it as `CODE_STYLE.md` (or drop it into your README).

````md
# Code Style Guide

This project uses **ESLint** and **Prettier** to ensure high code quality, consistency, and maintainability across the codebase.

---

## Tooling Configuration

### ESLint

- **Config file**: `.eslintrc.json`
- **Ignore file**: `.eslintignore`
- **Key rules**:
  - TypeScript support
  - Import/order validation
  - Maximum line length (120 characters)
  - Unused variable detection
  - Type safety enforcement

---

### Prettier

- **Config file**: `.prettierrc.json`
- **Ignore file**: `.prettierignore`
- **Formatting rules**:
  - Single quotes
  - Semicolons
  - 2-space indentation
  - Maximum line length (700 characters)

---

## Available Scripts

### Code Quality Checks

```bash
# Run ESLint checks
npm run lint

# Run ESLint with auto-fix
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format code
npm run format
```
````

---

## Git Hooks

This project uses Git hooks to enforce code quality automatically:

1. **pre-commit**
   Runs `lint-staged` before each commit

2. **commit-msg**
   Validates commit message format

---

## Commit Message Convention

All commit messages must follow this format:

```
type(scope): description
```

### Allowed types

- `feat` – New features
- `fix` – Bug fixes
- `docs` – Documentation updates
- `style` – Formatting or stylistic changes
- `refactor` – Code refactoring
- `test` – Test-related changes
- `chore` – Build process or tooling changes

### Examples

```
feat: add user authentication
fix(login): fix validation issue
docs: update API documentation
```

---

## Workflow

### During Development

1. Write code
2. Run `npm run lint` to check code quality
3. Run `npm run format` to format code

---

### Before Committing

1. Git hooks automatically run `lint-staged`
2. Auto-fix issues where possible
3. Validate commit message format
