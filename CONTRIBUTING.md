# Contributing to Occasio

Thank you for contributing to Occasio! Please follow these guidelines when contributing to the codebase.

---

## 1. Prerequisites

Before getting started, make sure you have the following installed on your development machine:

- **Node.js**: Version 20.x or higher
- **npm**: Version 10.x or higher
- **Docker Desktop** (or Docker Engine with Docker Compose) for managing the local MySQL instance

---

## 2. Local Environment Setup

Please follow the step-by-step instructions in the [README.md](README.md#setup-instructions) to:

1. Configure environment variables (`.env`)
2. Start MySQL via `docker compose up -d`
3. Install dependencies via `npm install`
4. Run migrations via `npm run db:migrate --workspace=backend`
5. Start development servers

---

## 3. Architecture & Coding Conventions

All code contributions must strictly adhere to the following repository architectural standards:

- **Strict Layering**: Code flows through `routes -> controller -> service -> repository`. Never query the database directly from controllers or services — all database queries must reside in `*.repository.ts` files using Knex.js.
- **No ORMs**: Knex.js query builder only. Do not introduce Prisma, TypeORM, Sequelize, or any other ORM.
- **Validation**: Every route must validate incoming requests using Zod schemas via the shared `validate()` middleware.
- **Standard Response Envelopes**: All responses must use standard JSON envelopes (`{ success: true, data, meta? }` via `sendResponse` for success; `{ error: { code, message, details? } }` via `AppError` and central error middleware for failures).
- **Authentication**: Use `authenticate` for protected routes requiring a logged-in user, and `optionalAuth` for public routes whose data visibility varies with authentication (e.g. private events).
- **Documentation**: Provide JSDoc docstrings for all exported service and repository functions, and `@swagger` JSDoc documentation on every route.

---

## 4. Git & Commit Conventions

We follow the **Conventional Commits** specification:

- `feat:` A new feature or endpoint
- `fix:` A bug fix
- `test:` Adding or updating tests
- `docs:` Documentation changes
- `chore:` Tooling, configuration, or dependency updates

Keep commits small, atomic, and scoped per module rather than committing large multi-module diffs.

---

## 5. Testing & Verification

Before opening a pull request or submitting changes, ensure the entire test suite passes and the project builds with zero TypeScript errors:

```bash
# Run all integration and unit tests
npm test

# Verify TypeScript compilation (backend)
npm run build --workspace=backend
```

Pull requests with failing tests or unmigrated schema changes will not be merged.
