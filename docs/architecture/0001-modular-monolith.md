# ADR 0001: Modular monolith

## Status

Accepted.

## Decision

LifeTracker starts as a Next.js web application and a FastAPI modular monolith backed by PostgreSQL. Backend code is organized by domain feature, and asynchronous work will use transactional outbox boundaries when it is introduced.

Authentication is implemented locally for the Phase 1 email/password requirement, but it remains isolated inside the authentication feature so an OIDC provider can be added without coupling identity code to financial business logic.

## Consequences

- Financial writes can use one transactional database.
- A small team can operate the system without microservice infrastructure.
- Domain boundaries must be enforced in code review and tests.
- A future mobile client can consume the same versioned API.

