# RBAC & Admin Provisioning Design

**Date:** 2026-03-05
**Status:** Approved
**Milestone:** v1.6 RBAC & Super Admin Operations

## Problem

1. Creating a new tenant via super admin does NOT create an admin user — chicken-and-egg problem
2. No real RBAC — `מנהל` bypasses everything, no granularity for coordinators, secretaries, vice-principals
3. No UI for tenant admins to manage roles and permissions for their staff

## Solution Overview

- **Admin provisioning**: Super admin creates tenant + first admin in one step (transaction)
- **Hybrid RBAC**: Hardcoded permission defaults per role, stored on tenant document, customizable by admin
- **Permission engine**: `requirePermission(domain, action)` replaces `requireAuth(roles[])`, with scope-based filtering (`all`, `department`, `own`)
- **Settings UI**: New "תפקידים והרשאות" tab — staff role assignment + permission matrix editor

---

## Role Categories

### Admin Tier (full system access)
| Role | Hebrew | Notes |
|------|--------|-------|
| Admin | מנהל | Full access, locked permissions (cannot be downgraded) |
| Vice Principal | סגן מנהל | Identical to מנהל |
| Secretariat | מזכירות | Identical to מנהל |

### Coordinator Tier (elevated teacher access)
| Role | Hebrew | Notes |
|------|--------|-------|
| General Coordinator | רכז/ת כללי | All students, orchestras, rehearsals, theory — like admin but no settings/roles/teachers-management |
| Department Coordinator | רכז/ת מחלקתי | Scoped to `coordinatorDepartments[]` — students with ANY matching instrument |

### Teaching Tier (own-scoped access)
| Role | Hebrew | Notes |
|------|--------|-------|
| Teacher | מורה | Own students, own schedule |
| Conductor | ניצוח | Own orchestras, rehearsals, students |
| Ensemble Coach | מדריך הרכב | Own orchestras, rehearsals, students |
| Theory Teacher | תאוריה | Theory, bagrut, own students |
| Piano Accompanist | ליווי פסנתר | Own students, own schedule |
| Composer | הלחנה | Own students, own schedule |
| Track Teacher | מורה מגמה | Own students, own schedule (future מגמה features) |

### View-Only
| Role | Hebrew | Notes |
|------|--------|-------|
| View Only | צפייה בלבד | Read-only across all visible resources |

**Combined roles**: A teacher can hold multiple roles (e.g. `['מורה', 'רכז/ת מחלקתי']`). Effective permissions = union of all roles (most permissive scope wins).

---

## Permission Domains & Actions

| Domain | Actions | Hebrew Label |
|--------|---------|-------------|
| `students` | `view`, `create`, `update`, `delete` | תלמידים |
| `schedules` | `view`, `create`, `update`, `delete` | מערכת שעות |
| `orchestras` | `view`, `create`, `update`, `delete` | תזמורות |
| `rehearsals` | `view`, `create`, `update`, `delete` | חזרות |
| `theory` | `view`, `create`, `update`, `delete` | תאוריה |
| `teachers` | `view`, `create`, `update`, `delete` | מורים |
| `reports` | `view`, `export` | דוחות |
| `settings` | `view`, `update` | הגדרות |
| `roles` | `view`, `assign` | תפקידים |

### Scope Modifiers
- **`all`** — unrestricted within tenant
- **`department`** — filtered by `coordinatorDepartments[]` using `getInstrumentsByDepartment()`
- **`own`** — only resources directly assigned to the teacher

Scope precedence for merging: `all` > `department` > `own` > none.

---

## Data Model Changes

### Teacher Document — New Fields
```js
{
  roles: ['מורה', 'רכז/ת מחלקתי'],           // expanded role set
  coordinatorDepartments: ['כלי קשת', 'כלי נשיפה-עץ']  // only when רכז/ת מחלקתי
}
```

### Tenant Document — New Field
```js
{
  rolePermissions: {
    "מנהל": {
      students:   { view: "all", create: "all", update: "all", delete: "all" },
      schedules:  { view: "all", create: "all", update: "all", delete: "all" },
      orchestras: { view: "all", create: "all", update: "all", delete: "all" },
      rehearsals: { view: "all", create: "all", update: "all", delete: "all" },
      theory:     { view: "all", create: "all", update: "all", delete: "all" },
      teachers:   { view: "all", create: "all", update: "all", delete: "all" },
      reports:    { view: "all", export: "all" },
      settings:   { view: "all", update: "all" },
      roles:      { view: "all", assign: "all" }
    },
    "סגן מנהל": { /* identical to מנהל */ },
    "מזכירות":  { /* identical to מנהל */ },
    "רכז/ת כללי": {
      students:   { view: "all", create: "all", update: "all", delete: "all" },
      orchestras: { view: "all", create: "all", update: "all", delete: "all" },
      rehearsals: { view: "all", create: "all", update: "all", delete: "all" },
      theory:     { view: "all", create: "all", update: "all", delete: "all" },
      reports:    { view: "all", export: "all" },
      teachers:   { view: "all" }
    },
    "רכז/ת מחלקתי": {
      students:   { view: "department", create: "department", update: "department", delete: "department" },
      orchestras: { view: "department", create: "department", update: "department", delete: "department" },
      rehearsals: { view: "department", create: "department", update: "department", delete: "department" },
      theory:     { view: "department", create: "department", update: "department", delete: "department" },
      reports:    { view: "department" }
    },
    "מורה": {
      students:   { view: "own", update: "own" },
      schedules:  { view: "own", create: "own", update: "own", delete: "own" }
    },
    "ניצוח": {
      students:   { view: "own" },
      schedules:  { view: "own", create: "own", update: "own", delete: "own" },
      orchestras: { view: "own", create: "own", update: "own", delete: "own" },
      rehearsals: { view: "own", create: "own", update: "own", delete: "own" }
    },
    "תאוריה": {
      students:   { view: "own", update: "own" },
      schedules:  { view: "own", create: "own", update: "own", delete: "own" },
      theory:     { view: "own", create: "own", update: "own", delete: "own" }
    },
    "מדריך הרכב": {
      students:   { view: "own", update: "own" },
      schedules:  { view: "own", create: "own", update: "own", delete: "own" },
      orchestras: { view: "own", update: "own" },
      rehearsals: { view: "own", create: "own", update: "own", delete: "own" }
    },
    "הלחנה":       { students: { view: "own" }, schedules: { view: "own", create: "own", update: "own" } },
    "ליווי פסנתר": { students: { view: "own" }, schedules: { view: "own", create: "own", update: "own" } },
    "מורה מגמה":   { students: { view: "own" }, schedules: { view: "own", create: "own", update: "own" } },
    "צפייה בלבד": {
      students:   { view: "all" },
      schedules:  { view: "all" },
      orchestras: { view: "all" },
      rehearsals: { view: "all" },
      theory:     { view: "all" },
      teachers:   { view: "all" },
      reports:    { view: "all" }
    }
  }
}
```

### TEACHER_ROLES Constant Expansion
```js
export const TEACHER_ROLES = [
  // Admin tier
  'מנהל', 'סגן מנהל', 'מזכירות',
  // Coordinator tier
  'רכז/ת כללי', 'רכז/ת מחלקתי',
  // Teaching tier
  'מורה', 'ניצוח', 'מדריך הרכב', 'תאוריה', 'ליווי פסנתר', 'הלחנה', 'מורה מגמה',
  // View-only
  'צפייה בלבד'
];

export const ADMIN_TIER_ROLES = ['מנהל', 'סגן מנהל', 'מזכירות'];
export const COORDINATOR_ROLES = ['רכז/ת כללי', 'רכז/ת מחלקתי'];
```

---

## Middleware Changes

### buildContext Extension
```js
req.context = {
  // existing
  tenantId, userId, userRoles, isAdmin,
  schoolYearId,
  scopes: { studentIds, orchestraIds },
  // NEW
  effectivePermissions: { students: { view: "all", ... }, ... },
  coordinatorDepartments: ['כלי קשת'],
  isCoordinator: true/false,
}
```

### requirePermission Middleware (replaces requireAuth)
```js
requirePermission(domain, action)
// 1. Checks req.context.effectivePermissions[domain][action]
// 2. Returns scope: 'all' | 'department' | 'own' | 403
// 3. Sets req.permissionScope for downstream service filtering
```

### Permission Resolution (in buildContext)
```
1. Load teacher.roles
2. Load tenant.rolePermissions (from cached tenant doc)
3. If rolePermissions missing → use hardcoded DEFAULT_ROLE_PERMISSIONS
4. For each role: merge permission maps (most permissive scope wins)
5. Store as req.context.effectivePermissions
```

### buildScopedFilter Extension
Existing `buildScopedFilter()` extended to handle `"department"` scope:
- Looks up `coordinatorDepartments` from context
- Calls `getInstrumentsByDepartment()` for each department
- Filters students by instrument match (any matching instrument, not just primary)

---

## API Changes

### New Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/settings/roles` | `requirePermission('roles', 'view')` | Get tenant rolePermissions + all staff with roles |
| `PUT` | `/api/settings/roles/:roleName` | `requirePermission('roles', 'assign')` | Update permissions for a role |
| `POST` | `/api/settings/roles/:roleName/reset` | `requirePermission('roles', 'assign')` | Reset role to defaults |
| `PUT` | `/api/teacher/:id/roles` | `requirePermission('roles', 'assign')` | Assign roles to teacher |

### Modified Endpoints
| What | Change |
|------|--------|
| `POST /api/super-admin/tenants` | Accepts `adminAccount: { firstName, lastName, email, idNumber? }`, creates tenant + admin in transaction |
| All route files | `requireAuth(roles[])` → `requirePermission(domain, action)` |
| `buildContext` | Resolves effectivePermissions |
| `buildScopedFilter` | Handles `"department"` scope |

---

## Tenant Creation Flow (Updated)

Super admin submits:
```json
{
  "name": "קונסרבטוריון חיפה",
  "slug": "haifa-conservatory",
  "city": "חיפה",
  "adminAccount": {
    "firstName": "שרה",
    "lastName": "כהן",
    "email": "sarah@haifa-conservatory.co.il"
  }
}
```

Backend (transaction):
1. Insert tenant with default `rolePermissions`
2. Create teacher: `roles: ['מנהל']`, password: hashed `'123456'`, `requiresPasswordChange: true`
3. Return both tenant + admin info

---

## Settings UI — Roles & Permissions Tab

### Staff Role Assignment
Table of all staff with current roles. Edit button opens modal with:
- Checkboxes for all available roles
- If רכז/ת מחלקתי selected → department multi-select dropdown (values from INSTRUMENT_DEPARTMENTS)

### Permission Matrix Editor
- Dropdown to select role
- Grid: domains (rows) × actions (columns)
- Checkboxes with scope indicators (all/department/own)
- Admin-tier domains (settings, roles) locked for non-admin roles
- "Reset to Default" button per role
- מנהל permissions are fully locked (prevent admin lockout)

---

## Safeguards

1. **Admin lockout prevention**: Cannot remove last מנהל from tenant, cannot downgrade מנהל permissions
2. **Locked domains**: `settings` and `roles` can only be granted to admin-tier roles
3. **Reset to defaults**: Each role can be individually reset to hardcoded defaults
4. **Migration safety**: Existing tenants get rolePermissions populated with defaults, existing teacher roles unchanged
5. **Backward compatibility**: If tenant.rolePermissions is missing, middleware falls back to hardcoded defaults
