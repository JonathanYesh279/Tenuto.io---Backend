# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Reliable multi-tenant music school management where every teacher sees only their tenant's data.
**Current focus:** v2.1 Entity Page Consistency — IN PROGRESS

## Current Position

Phase: 70 of 70 (Teachers Page Restyle & Login Activity Badges)
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase 70 complete — Teachers page restyled with login activity badges
Last activity: 2026-03-12 — Plan 70-02 executed

Progress: [##########] 100% (v2.1 Phase 70 — 2/2 plans)

## Performance Metrics

**All milestones:** 70 phases, 144 plans across 12 milestones
**v1.0:** 25 plans, 9 phases, 11 days (2026-02-14 -> 2026-02-24)
**v1.1:** 13 plans, 5 phases, 3 days (2026-02-24 -> 2026-02-26)
**v1.2:** 8 plans, 5 phases, 1 day (2026-02-27)
**v1.3:** 3 plans, 3 phases, 2 days (2026-02-27 -> 2026-02-28)
**v1.4:** 6 plans, 4 phases, 1 day (2026-02-28)
**v1.5:** 11 plans, 4 phases, 1 day (2026-03-02)
**v1.6:** 26 plans, 8 phases, 2 days (2026-03-03 -> 2026-03-04)
**v1.7:** 15 plans, 10 phases, 2 days (2026-03-05 -> 2026-03-06)
**v1.8:** 16 plans, 8 phases, 2 days (2026-03-06 -> 2026-03-07)
**v1.9:** 19 plans, 9 phases, 1 day (2026-03-07 -> 2026-03-08)
**v2.0:** 7 plans, 4 phases, 2 days (2026-03-10 -> 2026-03-11)

## Accumulated Context

### Decisions

- **[v2.0]** Token-first approach — define design tokens before migrating components
- **[v2.0]** Infrastructure only — update token system and shared components, don't touch individual pages
- **[v2.0]** Only ADD new CSS variable names — never change existing `:root` values (prior revert was caused by global changes)
- **[v2.0]** Primary color collision (CLR-01) is Phase 66 first plan — root blocker, must resolve before any visual cascade
- **[66-01]** primary-500 = #6366f1 (indigo), matching --primary CSS var — CLR-01 collision resolved
- **[66-01]** neutral scale uses direct var() refs (CSS vars already contain hsl() values)
- **[66-01]** warning/info have DEFAULT+foreground only — orange palette covers hex shade needs
- **[66-02]** Spacing values derived from current usage: page=24px, section=32px, card=24px, element=12px
- **[66-02]** Typography line heights Hebrew-optimized: 1.3-1.4 headings, 1.5-1.6 body
- **[66-02]** Table density tokens placed in spacing config for utility class flexibility
- **[67-01]** Semantic tokens (text-foreground, text-muted-foreground) preferred over neutral-NNN for dialog text
- **[67-01]** CVA Card variants: default=shadow-1, elevated=shadow-2, outlined=shadow-none+border-2
- **[67-01]** Graduated/pending badge variants kept as-is (no semantic token equivalents)
- **[67-02]** ActionButton delegates to CVA Button with variant/size mapping (single canonical button)
- **[67-02]** Dialog gap-4 kept as-is (no exact token match; spacing-element too tight, spacing-card too wide)
- **[67-02]** DialogTitle text-h3 is deliberate 2px increase (18->20px) for Hebrew readability
- **[67-03]** Calendar orange/purple event colors kept as raw Tailwind (no semantic equivalents)
- **[67-03]** ConfirmDeleteDialog severity colors (red/yellow/blue) are domain-specific, not migration targets
- **[67-03]** All 7 Phase 67 success criteria verified passing
- **[68-01]** No padding on PageShell — Layout.tsx already provides p-6, avoids double-padding bug
- **[68-01]** SectionWrapper uses semantic section element with h2 for title
- **[68-01]** FormLayout defaults to 2-column responsive grid
- **[69-01]** tailwind.config.js addComponents block left out of scope — used by Tailwind build step, not CSS dead code
- **[69-02]** All 4 remaining workaround CSS files classified as Permanent Exceptions — no migration targets remain
- **[69-02]** Permanent Exception header format established: FILE, STATUS, AUDITED, PURPOSE, WHY OVERRIDE CSS, COMPONENTS USING THIS FILE, MIGRATION NOTES
- **[v2.0]** v1.9 archived as-is with phases 61-65 deferred/completed outside GSD tracking
- **[v2.0]** All work in frontend repo: `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend/src`
- **[70-01]** MongoDB $inc for loginCount — auto-creates field on first increment, no migration needed
- **[70-01]** loginCount/lastLogin extracted in enrichment layer, not query projection
- **[70-02]** Full client-side pagination (20/page) replacing server-side load-more for Teachers page
- **[70-02]** Entity page restyle pattern established: GlassStatCard + GlassSelect + SearchInput + HeroUI Table/Pagination

### Pending Todos

- **[Future DevOps milestone]** Configure email service for forgot-password flow: set SendGrid/Gmail credentials, FRONTEND_URL, FROM_EMAIL in production .env. Code is complete — just needs deployment config.

### Roadmap Evolution

- Phase 70 added: Teachers Page Restyle & Login Activity Badges (v2.1 Entity Page Consistency)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-12
Stopped at: Completed 70-02-PLAN.md (Teachers page restyle — phase 70 complete)
Resume file: None
