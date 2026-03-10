# Requirements: Tenuto.io v2.0 Design System Infrastructure

**Defined:** 2026-03-10
**Core Value:** Consistent, token-based design system across the frontend — no visual redesign, just reliable infrastructure

## v2.0 Requirements

### Color Tokens

- [ ] **CLR-01**: Primary color collision resolved — `bg-primary` and `bg-primary-500` map to the same color value across the app
- [ ] **CLR-02**: Neutral scale wired into Tailwind config — `neutral-50` through `neutral-900` classes available, bridging existing `--neutral-*` CSS vars
- [ ] **CLR-03**: Semantic status tokens added — `--success`, `--warning`, `--info` CSS vars with foreground variants, usable via Tailwind classes
- [ ] **CLR-04**: Shared UI components (`src/components/ui/`) migrated from hardcoded `gray-NNN` to semantic `neutral-NNN` or `muted` tokens

### Spacing Tokens

- [ ] **SPC-01**: Semantic spacing scale defined in Tailwind config — named tokens for page padding, section gap, card gap, element gap
- [ ] **SPC-02**: PageShell layout primitive created — enforces consistent page padding, max-width, and content structure
- [ ] **SPC-03**: SectionWrapper layout primitive created — enforces consistent section spacing and heading placement
- [ ] **SPC-04**: FormLayout layout primitive created — enforces consistent form field spacing, label alignment, and section grouping

### Typography Tokens

- [ ] **TYP-01**: Semantic type scale defined in Tailwind config — 7 named steps (display, h1, h2, h3, body, small, caption) with size + weight + line-height
- [ ] **TYP-02**: Shared heading components updated to use semantic type scale tokens consistently

### Component Standardization

- [ ] **CMP-01**: CVA Button is the single canonical button — ActionButton delegates to it, `.btn-*` CSS classes deprecated with comments
- [ ] **CMP-02**: Table component standardized — consistent row height, cell padding, header styling using spacing/typography tokens
- [ ] **CMP-03**: Card component updated with CVA variants (default, elevated, outlined) using shadow tokens
- [ ] **CMP-04**: Badge component updated to use semantic color tokens (success, warning, info) instead of raw Tailwind colors
- [ ] **CMP-05**: Input component standardized with consistent sizing, border, focus ring tokens
- [ ] **CMP-06**: Dialog component updated with shadow tokens and consistent padding/spacing

### Table & Calendar Styling

- [ ] **TCS-01**: Table density tokens defined — compact row height (40-44px), cell padding, header styling as named values
- [ ] **TCS-02**: Calendar CSS token overrides created — CSS variable overrides for calendar components matching the design system colors/spacing

### CSS Cleanup

- [ ] **CSS-01**: All 5 workaround CSS files audited — each file documented with purpose and migration feasibility
- [ ] **CSS-02**: Migratable workaround CSS consolidated into Tailwind config or component-level styles

## Future Requirements

### Page-Level Migration

- **PAGE-01**: All 29 pages migrated from hardcoded spacing to semantic spacing tokens
- **PAGE-02**: All ~1,211 hardcoded `primary-NNN` color references migrated to semantic primary token
- **PAGE-03**: All ~6,060 `gray-NNN` references migrated to `neutral-NNN` tokens

### Advanced Design System

- **ADV-01**: Dark mode validated against all new tokens
- **ADV-02**: Design system documentation page with live examples
- **ADV-03**: Tailwind v4 migration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Page-level class migrations | Infrastructure only — pages adopt tokens naturally over time |
| Visual redesign of any page | Conservative milestone — no visual changes, just consistency |
| New animations/motion | Not in scope — existing Framer Motion presets sufficient |
| Tailwind v4 upgrade | Breaking change with shadcn — separate milestone |
| New color palette/brand change | Existing colors are fine — just need consistent application |
| Component API changes | Only className changes — no prop surface changes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLR-01 | Phase 66 | Pending |
| CLR-02 | Phase 66 | Pending |
| CLR-03 | Phase 66 | Pending |
| CLR-04 | Phase 67 | Pending |
| SPC-01 | Phase 66 | Pending |
| SPC-02 | Phase 68 | Pending |
| SPC-03 | Phase 68 | Pending |
| SPC-04 | Phase 68 | Pending |
| TYP-01 | Phase 66 | Pending |
| TYP-02 | Phase 67 | Pending |
| CMP-01 | Phase 67 | Pending |
| CMP-02 | Phase 67 | Pending |
| CMP-03 | Phase 67 | Pending |
| CMP-04 | Phase 67 | Pending |
| CMP-05 | Phase 67 | Pending |
| CMP-06 | Phase 67 | Pending |
| TCS-01 | Phase 66 | Pending |
| TCS-02 | Phase 67 | Pending |
| CSS-01 | Phase 69 | Pending |
| CSS-02 | Phase 69 | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 — traceability complete after roadmap creation*
