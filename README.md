# Occasio

A full-stack event planning platform built with Node.js, Express, TypeScript, Knex.js, and MySQL.

---

## Engineering Decisions

### 1. Express + Knex.js + MySQL (No ORMs)

- **Design Choice & Assessment Constraint**: The backend uses Knex.js query builder directly over MySQL without ORMs (such as Prisma, TypeORM, or Sequelize).
- **Rationale & Trade-offs**: While ORMs provide high-level abstractions, a query builder grants full visibility and control over generated SQL queries, indexing, joins, and execution plans. This avoids the query bloat, opaque hydration overhead, and schema drift common with heavy ORMs, while maintaining strong type safety with TypeScript.

### 2. Strict Layered Architecture (`routes -> controller -> service -> repository`)

- **Routes (`*.routes.ts`)**: Defines HTTP endpoints, applies validation middleware (`validate(schema)`), authentication middleware (`authenticate` or `optionalAuth`), and embeds Swagger OpenAPI annotations.
- **Controller (`*.controller.ts`)**: Handles HTTP transport concerns, extracts typed request parameters/body, delegates to domain services, and structures responses using the standardized envelope via `sendResponse`.
- **Service (`*.service.ts`)**: Encapsulates core business logic, domain rules, and authorization/ownership validation (e.g., verifying that only an event's creator can update or delete it).
- **Repository (`*.repository.ts`)**: The **only** layer that interfaces directly with Knex and executes database queries. Confining database operations to repositories keeps data access completely isolated and mockable for testing.

### 3. JWT Authentication with Rotating Refresh Tokens

- **Short-Lived Access Tokens**: Issued with a 15-minute expiry and sent in JSON response bodies for Bearer authorization. This bounds exposure time in the event of client-side token interception.
- **Long-Lived Refresh Tokens**: Issued with a 7-day expiry and stored in an `httpOnly`, `SameSite=Strict`, `Secure` (in production) cookie, completely inaccessible to browser JavaScript to guard against XSS extraction.
- **Token Hashing & Rotation**: Refresh tokens are stored in the database only as SHA-256 hashes. Upon every refresh request, the existing refresh token is immediately revoked (invalidated) and replaced with a newly issued token pair (rotation), preventing replay attacks and detectably invalidating compromised token chains.

### 4. Centralized Config, Constants & Validation

- **Typed Environment Variables**: Loaded and validated via Zod in `src/config/env.ts` at startup to ensure fail-fast initialization if required variables are missing or malformed.
- **Central Constants**: All HTTP status codes (`httpStatus`), domain error codes (`errorCodes`), and messages (`errorMessages`) are organized in `src/constants/`, eliminating magic numbers and ad-hoc strings across the codebase.
- **Zod Request Validation**: Every route validates incoming payload structures before reaching controllers via `validate()` middleware.

### 5. Standardized Response Envelopes

Every API endpoint adheres to uniform JSON response envelopes:

- **Success Responses**:

  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "limit": 10, "total": 100 }
  }
  ```

  *(The `meta` object is optional and omitted when pagination/filtering metadata is not present).*
- **Error Responses**:

  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable error description",
      "details": [
        { "field": "fieldName", "message": "Field error description" }
      ]
    }
  }
  ```

  *(The `details` property is optional and specifically populated on validation failures (`400 Bad Request`) to provide field-level error messages; it is omitted on other error responses).*

### 6. Interactive OpenAPI / Swagger Documentation

- Every route is documented with `@swagger` JSDoc annotations referencing shared schemas (`ErrorResponse`, `BearerAuth`).
- Interactive Swagger UI documentation is automatically generated and served at `/api-docs`.

---

## Setup Instructions

Follow these steps for setting up and running the project locally (tested on Windows PowerShell, macOS, and Linux):

### 1. Configure Environment Variables

Copy the example environment configuration to create your `.env` file:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Bash / Zsh
cp .env.example .env
```

Ensure database credentials, server port, and JWT secrets in `.env` match your local environment.

### 2. Start MySQL Database

Launch the MySQL container in the background using Docker Compose:

```bash
docker compose up -d
```

### 3. Install Dependencies

Install all workspace dependencies from the root directory:

```bash
npm install
```

### 4. Run Database Migrations

Execute Knex migrations to create database tables (`users`, `refresh_tokens`, `events`):

```bash
npm run db:migrate --workspace=backend
```

### 5. Start Backend Server

Run the backend in development mode with live reloading:

```bash
npm run dev --workspace=backend
```

### 6. Verify API & Documentation

Open your browser and navigate to:

- **Swagger Documentation**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

*(Note: Frontend workspace setup will be added here in an upcoming module).*

### 7. Run Test Suite

Execute the integration test suite across all modules:

```bash
npm test
```

---

## Assumptions

- **Private Event Visibility**: Events with `event_type = 'private'` are strictly visible only to their creator. When queried by unauthenticated visitors or other users, private events are excluded from `GET /events` listings, and direct lookups via `GET /events/:id` return `404 Not Found` (`EVENT_NOT_FOUND`) rather than `403 Forbidden`. This avoids confirming or leaking the existence of private events to unauthorized parties.
- *(Additional assumptions for tag filtering, pagination, and frontend interactions will be documented here as those modules are introduced).*
