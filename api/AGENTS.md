# Vina_TrekGo — Codex Repository Instructions

## Area B: Rental / Inventory / Preparation / Delivery / Returns

The authoritative business specifications for Area B are located in `docs/rental/sot/`.

Mandatory documents:

- Policy v1.5.2 — BA-TASK-ASSIGNMENT-04
- Business Flow v1.3.2 — BA-TASK-ASSIGNMENT-04
- Functional Requirements v1.3.2 — BA-TASK-ASSIGNMENT-04

Read `docs/rental/README.md` before working on Area B.

## Source of Truth authority

- Policy defines business rules, thresholds, configuration and financial behavior.
- Business Flow defines the sequence of operations, actor responsibilities and exceptions.
- Functional Requirements defines APIs, DTOs, states, errors, permissions and acceptance criteria.
- Existing source code is evidence of implementation, not authority to override approved business rules.
- Markdown mirrors under `docs/rental/reference/` are for navigation. The DOCX originals are authoritative.

If documents conflict or a requirement is ambiguous, report it and request a decision. Never silently invent a rule.

## Versions

- policyVersion: 1.5.2
- Business Flow version: 1.3.2
- Functional Requirements version: 1.3.2
- Deployed API contract baseline: 1.3.2, subject to runtime verification
- New API contract target: 1.3.3 — NOT assumed deployed

Do not describe a feature as deployed solely because source code or a patch exists.

## Architecture

Follow the existing NestJS + Prisma + PostgreSQL architecture and repository conventions.

Respect module boundaries and use existing use cases, ports, adapters, transactions, guards and shared services.

Do not introduce parallel business implementations or cross-module database writes without permission.

## Mandatory invariants

1. Validate Trip membership via Area A. Do not use bookingId as authorization.
2. Rental availability is quantity-based over occupied windows. Never overbook.
3. Assign physical EquipmentUnits only during preparation after payment.
4. Follow the single primary InventoryLocation policy.
5. Handover is all-or-nothing. Never silently perform partial handover.
6. Distinguish task ownership from physical custody.
7. Preserve inspection SLA from inventory custody ACK.
8. STAFF_DELIVERY does not decide FINAL inspection or deposit deductions.
9. Refunds must follow original payment sources and provider-confirmed statuses.
10. Extension requires capacity validation and the official payment flow.
11. Do not automatically assign staff or release claimed tasks.
12. Protect mutations with repository-standard idempotency, concurrency controls and audit logs.

## Implementation workflow

Before changing Area B code:

1. Inspect the relevant existing implementation.
2. Identify the supporting SOT references and API/FR IDs.
3. Compare current behavior with the approved requirement.
4. Identify backward compatibility, state, custody, money and concurrency risks.
5. Propose a minimal change plan.
6. Implement only within approved scope.
7. Add unit, integration and regression tests.
8. Run available validation commands and report actual results.

Never claim a test passed unless it actually ran.

Do not modify unrelated modules or introduce destructive Prisma migrations without explicit approval.
