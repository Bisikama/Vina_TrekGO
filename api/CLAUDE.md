# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TrekGo backend: NestJS 11 + Prisma 6 (PostgreSQL) + Zod, with MongoDB (Mongoose) for notifications, Supabase for identity, Socket.IO for realtime. Also read `../AGENTS.md` (booking/CF01 + error-contract rules) and `./AGENTS.md` (Area B rental rules) — both are binding.

Detailed guidance lives in `.claude/rules/`:

- Always loaded: `commands.md`, `architecture.md`, `error-contract.md`, `database.md`.
- Loaded when working on matching files: `trips-bookings.md`, `rental.md`, `payments.md`, `identity-gps-trails.md`, `supporting-modules.md`.

Other project tooling in `.claude/`:

- `agents/`: `researcher` (read-only flow tracing), `code-reviewer` (checks a diff against these conventions), `tester` (focused Jest tests).
- `skills/add-error-code`: the full checklist for adding an `AppError` code.
- `settings.json` + `hooks/guard-db.mjs`: blocks `prisma migrate reset`, `prisma db push`, `--force-reset` and `--accept-data-loss`.
