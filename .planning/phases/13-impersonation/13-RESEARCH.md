# Phase 13: Impersonation - Research

**Researched:** 2026-02-25
**Domain:** JWT-based admin impersonation, dual-identity audit logging, frontend auth state management
**Confidence:** HIGH

## Summary

Phase 13 implements super admin impersonation of tenant admins. The super admin needs to "become" a tenant admin, seeing exactly what they see, while every action is audit-logged with both the super admin identity and the impersonated context. The frontend must show a persistent banner during impersonation with an "Exit" button that restores the original super admin session without re-login.

The core challenge is threading two identities through the existing middleware chain (`authenticateToken -> buildContext -> enforceTenant -> stripTenantId -> addSchoolYearToRequest`). The recommended approach is an **impersonation token** -- a JWT signed with the same secret as regular teacher tokens, containing the impersonated admin's `_id` and `tenantId` (so `authenticateToken` passes it through transparently), plus additional claims (`impersonatedBy`, `isImpersonation`) that the audit layer uses. This requires zero changes to `authenticateToken`, `buildContext`, `enforceTenant`, or any downstream middleware/service.

On the frontend, the key challenge is localStorage collision: both super admin and regular admin tokens are stored under `authToken`. The solution is to **stash** the super admin token before impersonation and **restore** it on exit. The frontend auth context already differentiates via `loginType` in localStorage, which provides the foundation for impersonation state management.

**Primary recommendation:** Issue a standard-format JWT containing the impersonated admin's identity fields (same as `generateAccessToken` output) plus `impersonatedBy` and `isImpersonation` claims. Existing middleware passes it through unchanged. Add a thin audit-enrichment middleware on all tenant-scoped routes. Frontend stashes super admin token and sets impersonation token, with a persistent banner component.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonwebtoken | ^9.0.2 | JWT signing/verification (already installed) | Signs impersonation tokens with same secret |
| express | ^4.21.2 | Route/middleware (already installed) | New impersonation routes + audit middleware |
| mongodb | ^6.13.0 | Native driver (already installed) | Impersonation session tracking |
| joi | ^17.13.3 | Validation (already installed) | Validate impersonation request body |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new dependencies needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom impersonation JWT | OAuth 2.0 Token Exchange (RFC 8693) | RFC 8693 is the formal standard with `act` claim, but requires an authorization server; overkill for a single-app system with 1-5 super admins |
| Stashing super admin token in localStorage | Separate cookie-based session | More complex; super admin already uses Bearer tokens in localStorage, not cookies for the access token |
| Impersonation token with teacher lookup | Session-based impersonation (no JWT) | Would require modifying `authenticateToken` to check session store; higher coupling |

**Installation:**
```bash
# No new packages needed -- all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
api/super-admin/
  super-admin.route.js          # Add: POST /impersonate/:tenantId, POST /stop-impersonation
  super-admin.controller.js     # Add: startImpersonation, stopImpersonation
  super-admin.service.js        # Add: startImpersonation, stopImpersonation
  super-admin.validation.js     # Add: impersonationStartSchema
middleware/
  impersonation-audit.middleware.js  # NEW: enriches audit context on impersonated requests
config/
  constants.js                  # Add: AUDIT_ACTIONS for impersonation
services/
  auditTrail.service.js         # Extend: logImpersonatedAction function
```

### Pattern 1: Impersonation Token Design
**What:** A JWT that looks exactly like a regular teacher access token to `authenticateToken`, but carries additional claims for the audit layer.
**When to use:** Always -- this is the core mechanism.
**Example:**
```javascript
// Impersonation token payload (same structure as generateAccessToken + extras)
const impersonationTokenPayload = {
  // === Standard teacher token fields (required by authenticateToken) ===
  _id: targetAdmin._id.toString(),        // The impersonated admin's teacher ID
  tenantId: targetAdmin.tenantId,          // The target tenant
  firstName: targetAdmin.personalInfo?.firstName || '',
  lastName: targetAdmin.personalInfo?.lastName || '',
  email: targetAdmin.credentials.email,
  roles: targetAdmin.roles,                // Will include 'מנהל'
  version: targetAdmin.credentials?.tokenVersion || 0,

  // === Impersonation-specific fields ===
  isImpersonation: true,
  impersonatedBy: superAdmin._id.toString(),  // The super admin who initiated
  impersonationSessionId: sessionId,           // For tracking/revocation
};

// Sign with SAME secret and SHORTER expiry
const token = jwt.sign(
  impersonationTokenPayload,
  process.env.ACCESS_TOKEN_SECRET,
  { expiresIn: '1h' }  // Shorter than regular 1h, or same -- 1h is already conservative
);
```

### Pattern 2: Token Stashing on Frontend
**What:** Before starting impersonation, save the super admin's auth state to sessionStorage, then replace with impersonation token. On exit, restore from sessionStorage.
**When to use:** Every impersonation start/stop cycle.
**Example:**
```javascript
// START impersonation
function startImpersonation(impersonationData) {
  // 1. Stash current super admin state
  const currentToken = localStorage.getItem('authToken');
  const currentLoginType = localStorage.getItem('loginType');
  const currentUser = localStorage.getItem('superAdminUser');

  sessionStorage.setItem('preImpersonation_authToken', currentToken);
  sessionStorage.setItem('preImpersonation_loginType', currentLoginType);
  sessionStorage.setItem('preImpersonation_superAdminUser', currentUser);

  // 2. Set impersonation state
  localStorage.setItem('authToken', impersonationData.accessToken);
  localStorage.setItem('loginType', 'impersonation');
  localStorage.setItem('impersonationContext', JSON.stringify({
    superAdminId: impersonationData.superAdminId,
    tenantId: impersonationData.tenantId,
    tenantName: impersonationData.tenantName,
    impersonatedAdminName: impersonationData.adminName,
    sessionId: impersonationData.sessionId,
    startedAt: new Date().toISOString(),
  }));

  // 3. Update ApiClient in-memory token
  apiClient.setToken(impersonationData.accessToken);
}

// STOP impersonation
function stopImpersonation() {
  // 1. Restore super admin state
  const savedToken = sessionStorage.getItem('preImpersonation_authToken');
  const savedLoginType = sessionStorage.getItem('preImpersonation_loginType');
  const savedUser = sessionStorage.getItem('preImpersonation_superAdminUser');

  localStorage.setItem('authToken', savedToken);
  localStorage.setItem('loginType', savedLoginType);
  localStorage.setItem('superAdminUser', savedUser);

  // 2. Clean up impersonation state
  localStorage.removeItem('impersonationContext');
  sessionStorage.removeItem('preImpersonation_authToken');
  sessionStorage.removeItem('preImpersonation_loginType');
  sessionStorage.removeItem('preImpersonation_superAdminUser');

  // 3. Update ApiClient in-memory token
  apiClient.setToken(savedToken);
}
```

### Pattern 3: Audit Enrichment Middleware
**What:** A lightweight middleware that detects impersonation tokens and enriches the request context with both identities for audit logging.
**When to use:** Applied to all tenant-scoped routes (in server.js middleware chain or as a global post-auth middleware).
**Example:**
```javascript
// middleware/impersonation-audit.middleware.js
import jwt from 'jsonwebtoken';
import { createLogger } from '../services/logger.service.js';

const log = createLogger('impersonation-audit');

export function enrichImpersonationContext(req, res, next) {
  try {
    // Only process if we have a teacher (authenticated request)
    if (!req.teacher) return next();

    // Decode token to check for impersonation claims
    // Token is already verified by authenticateToken, so we just decode
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.decode(token); // decode only, already verified

    if (decoded?.isImpersonation) {
      req.impersonation = {
        isImpersonation: true,
        superAdminId: decoded.impersonatedBy,
        sessionId: decoded.impersonationSessionId,
        impersonatedUserId: decoded._id,
        tenantId: decoded.tenantId,
      };

      log.debug({
        superAdminId: decoded.impersonatedBy,
        impersonatedUserId: decoded._id,
        path: req.path,
        method: req.method,
      }, 'Impersonation request detected');
    }

    next();
  } catch (err) {
    // Audit enrichment must never break the request
    log.warn({ err: err.message }, 'Error in impersonation audit enrichment');
    next();
  }
}
```

### Pattern 4: Impersonation Session Tracking
**What:** A `platform_audit_log` entry (not a separate collection) tracks impersonation session start/stop. Individual actions use `req.impersonation` context.
**When to use:** On start and stop of every impersonation session.
**Design decision:** Do NOT create a separate `impersonation_sessions` collection. Use the existing `platform_audit_log` with `IMPERSONATION_STARTED` / `IMPERSONATION_ENDED` actions. This keeps the audit trail in one place and avoids schema proliferation.

### Anti-Patterns to Avoid
- **Modifying authenticateToken:** The existing auth middleware works perfectly with the impersonation token. Do NOT add impersonation logic to it -- keep it a pure "is this a valid teacher JWT?" check.
- **Dual-token approach:** Do NOT issue two tokens (one super admin, one impersonation) and send both in headers. This adds complexity to every API call.
- **Modifying buildContext for impersonation:** The context should reflect the impersonated user's context. The impersonation metadata goes on `req.impersonation`, not `req.context`.
- **Storing impersonation state in the database session:** The JWT IS the session. No need for server-side session store. The `platform_audit_log` entries serve as the historical record.
- **Read-only guard (ASEC-03):** This is explicitly deferred to v2 scope. Do NOT implement write restrictions during impersonation in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing | Custom token format | `jwt.sign()` with same ACCESS_TOKEN_SECRET | Must pass through existing `authenticateToken` unchanged |
| Audit logging | Custom logging collection | Existing `auditTrail.service.js` + `platform_audit_log` collection | Already has the right schema, defensive error handling |
| Token validation | Custom impersonation verifier | Existing `authenticateToken` middleware | Impersonation token is designed to be indistinguishable from a regular token to this middleware |
| Frontend state management | Custom impersonation context | Extend existing `AuthContext` + localStorage/sessionStorage | The auth context already handles super admin vs regular admin |
| Tenant active check | Custom check in impersonation flow | Existing `tenant.isActive` check in `authenticateToken` | Already blocks requests to deactivated tenants |

**Key insight:** The entire impersonation system is designed to leverage existing infrastructure. The impersonation token IS a regular JWT. The audit log IS the existing platform_audit_log. The auth context IS the existing AuthContext. The only truly new code is: (1) token generation, (2) audit enrichment middleware, (3) 2 API endpoints, (4) frontend banner component.

## Common Pitfalls

### Pitfall 1: Token Collision in localStorage
**What goes wrong:** Both super admin and impersonated admin tokens stored under `authToken` key -- starting impersonation overwrites the super admin token, and stopping impersonation has nothing to restore.
**Why it happens:** The ApiClient stores tokens at a single key (`authToken`).
**How to avoid:** Stash the super admin token in `sessionStorage` (separate from `localStorage`) before overwriting with impersonation token. Use `sessionStorage` so it auto-clears on tab close.
**Warning signs:** Super admin cannot return to their dashboard after ending impersonation; they're forced to re-login.

### Pitfall 2: Impersonation Token Survives Page Refresh
**What goes wrong:** User refreshes the page during impersonation. The `checkAuthStatus` function in AuthContext sees `authToken` in localStorage and validates it as a regular teacher token, losing the impersonation UI context.
**Why it happens:** `checkAuthStatus` checks `loginType` in localStorage to differentiate super admin vs regular. During impersonation, `loginType` must be set to a new value (`'impersonation'`) so the validation logic knows to show the impersonation banner.
**How to avoid:** Set `loginType = 'impersonation'` in localStorage. Store impersonation metadata (tenant name, session ID) in localStorage under a dedicated key (`impersonationContext`). On page refresh, if `loginType === 'impersonation'`, restore the banner from stored metadata.
**Warning signs:** Impersonation banner disappears on refresh but the user is still operating as the impersonated admin.

### Pitfall 3: Impersonating a Deactivated Tenant
**What goes wrong:** Super admin impersonates a tenant admin, then a second super admin deactivates that tenant. The impersonation token still works until it expires.
**Why it happens:** `authenticateToken` already checks `tenant.isActive` on every request. So this is actually handled by existing infrastructure.
**How to avoid:** No additional work needed. The existing `tenant.isActive` check in `authenticateToken` (lines 61-75) will reject the impersonation token's requests if the tenant gets deactivated mid-session.
**Warning signs:** None -- this is already handled. Just verify in testing.

### Pitfall 4: School Year Context During Impersonation
**What goes wrong:** The `addSchoolYearToRequest` middleware looks up the current school year by `tenantId`. During impersonation, this should resolve to the impersonated tenant's school year, not create a new one.
**Why it happens:** The impersonation token carries the correct `tenantId`, so `buildContext` builds the right context, and `addSchoolYearToRequest` queries by that `tenantId`. This should work automatically.
**How to avoid:** Verify in testing that school year resolution uses the impersonated tenant's context.
**Warning signs:** Impersonated admin sees "wrong" school year or a newly created default school year.

### Pitfall 5: Frontend Route Guards During Impersonation
**What goes wrong:** The frontend has route guards that check `user.isSuperAdmin` to show/hide super admin routes. During impersonation, the user looks like a regular admin, so super admin routes become inaccessible -- which is correct. But the "Exit Impersonation" mechanism must still be accessible.
**Why it happens:** The impersonation banner must be rendered outside route guards, at the layout level.
**How to avoid:** Place the impersonation banner at the top of the main `Layout` component, before any route-guarded content. It reads `impersonationContext` from localStorage, not from the auth user object.
**Warning signs:** User cannot exit impersonation because the exit button is inside a guarded route.

### Pitfall 6: Audit Log Noise
**What goes wrong:** Every GET request during impersonation is logged, creating thousands of read-only audit entries that obscure important actions.
**Why it happens:** Over-eager audit logging middleware.
**How to avoid:** Only log mutating actions (POST, PUT, PATCH, DELETE) during impersonation. GET requests should be logged at DEBUG level only, not as audit entries. Exception: the impersonation START and STOP events should always be logged.
**Warning signs:** Audit log has thousands of entries for a 10-minute impersonation session.

## Code Examples

Verified patterns from the existing codebase:

### Existing JWT Token Generation (auth.service.js)
```javascript
// Source: api/auth/auth.service.js lines 285-301
function generateAccessToken(teacher) {
  const tokenData = {
    _id: teacher._id.toString(),
    tenantId: teacher.tenantId || null,
    firstName: teacher.personalInfo?.firstName || '',
    lastName: teacher.personalInfo?.lastName || '',
    email: teacher.credentials.email,
    roles: teacher.roles,
    version: teacher.credentials?.tokenVersion || 0
  }
  return jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
}
```

### Existing Super Admin Token Generation (super-admin.service.js)
```javascript
// Source: api/super-admin/super-admin.service.js lines 67-71
const accessToken = jwt.sign(
  { _id: admin._id.toString(), type: 'super_admin', email: admin.email },
  process.env.ACCESS_TOKEN_SECRET,
  { expiresIn: '1h' }
);
```

### Existing Audit Trail Logging (auditTrail.service.js)
```javascript
// Source: services/auditTrail.service.js lines 24-48
async function logAction(action, actorId, details = {}) {
  try {
    const collection = await getCollection(COLLECTIONS.PLATFORM_AUDIT_LOG);
    const { targetType, targetId, ip, ...restDetails } = details;
    const entry = {
      action,
      actorId,
      actorType: 'super_admin',
      targetType: targetType || 'tenant',
      targetId: targetId || null,
      details: restDetails,
      timestamp: new Date(),
      ip: ip || null,
    };
    await collection.insertOne(entry);
  } catch (err) {
    log.error({ err: err.message, action, actorId }, 'Failed to write audit log entry');
  }
}
```

### Existing Frontend Token Storage (apiService.js)
```javascript
// Source: frontend src/services/apiService.js lines 36-55
getStoredToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}
setToken(token) {
  this.token = token;
  localStorage.setItem('authToken', token);
}
removeToken() {
  this.token = null;
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
}
```

### Existing Frontend Auth Login Type Check (authContext.jsx)
```javascript
// Source: frontend src/services/authContext.jsx lines 76-131
const loginType = localStorage.getItem('loginType')
if (loginType === 'super_admin') {
  // ... super admin validation flow
}
```

### Impersonation Token Generation (NEW -- to be implemented)
```javascript
// api/super-admin/super-admin.service.js -- new function
async function startImpersonation(tenantId, superAdminId) {
  // 1. Find tenant and validate it's active
  const tenantCollection = await getCollection(COLLECTIONS.TENANT);
  const tenant = await tenantCollection.findOne({
    _id: ObjectId.createFromHexString(tenantId),
  });
  if (!tenant) throw new Error(`Tenant with id ${tenantId} not found`);
  if (!tenant.isActive) throw new Error('Cannot impersonate a deactivated tenant');

  // 2. Find an admin teacher in this tenant
  const teacherCollection = await getCollection(COLLECTIONS.TEACHER);
  const tenantIdStr = tenant.tenantId || tenant._id.toString();
  const adminTeacher = await teacherCollection.findOne({
    tenantId: tenantIdStr,
    roles: 'מנהל',
    isActive: true,
  });
  if (!adminTeacher) throw new Error('No active admin found for this tenant');

  // 3. Generate impersonation token (same shape as regular teacher token + extras)
  const sessionId = new ObjectId().toString(); // Unique session identifier

  const tokenPayload = {
    _id: adminTeacher._id.toString(),
    tenantId: adminTeacher.tenantId,
    firstName: adminTeacher.personalInfo?.firstName || '',
    lastName: adminTeacher.personalInfo?.lastName || '',
    email: adminTeacher.credentials.email,
    roles: adminTeacher.roles,
    version: adminTeacher.credentials?.tokenVersion || 0,
    // Impersonation-specific
    isImpersonation: true,
    impersonatedBy: superAdminId,
    impersonationSessionId: sessionId,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );

  // 4. Log impersonation start
  await auditTrailService.logAction(AUDIT_ACTIONS.IMPERSONATION_STARTED, superAdminId, {
    targetId: tenantId,
    targetType: 'tenant',
    tenantName: tenant.name,
    impersonatedAdminId: adminTeacher._id.toString(),
    impersonatedAdminEmail: adminTeacher.credentials.email,
    sessionId,
  });

  return {
    accessToken,
    sessionId,
    tenant: {
      _id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
    },
    impersonatedAdmin: {
      _id: adminTeacher._id.toString(),
      name: `${adminTeacher.personalInfo?.firstName || ''} ${adminTeacher.personalInfo?.lastName || ''}`.trim(),
      email: adminTeacher.credentials.email,
    },
  };
}
```

### Impersonation Banner Component (NEW -- to be implemented)
```tsx
// Frontend: src/components/ImpersonationBanner.tsx
export default function ImpersonationBanner() {
  const loginType = localStorage.getItem('loginType');
  if (loginType !== 'impersonation') return null;

  const context = JSON.parse(localStorage.getItem('impersonationContext') || '{}');

  return (
    <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-2">
        <ShieldIcon weight="bold" size={20} />
        <span className="font-medium">
          מצב התחזות: צפייה כ-{context.impersonatedAdminName} ({context.tenantName})
        </span>
      </div>
      <button onClick={handleExitImpersonation} className="bg-white text-amber-600 px-3 py-1 rounded text-sm font-medium">
        יציאה מהתחזות
      </button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared session with "acting as" flag | JWT with embedded impersonation claims | RFC 8693 (2020) standardized | JWTs are self-contained; no server session needed |
| Separate impersonation endpoint tree | Same endpoints, different token | Common SaaS pattern (Stripe, Intercom) | Zero endpoint duplication |
| Modifying auth middleware | Transparent pass-through + audit middleware | Best practice for separation of concerns | Auth stays simple, audit is additive |

**Deprecated/outdated:**
- Sharing super admin credentials with tenant admin: Security anti-pattern, never acceptable
- Server-side impersonation session with cookie: Adds state management complexity; JWT approach is stateless

## Open Questions

1. **Should impersonation token have a shorter TTL than regular tokens?**
   - What we know: Regular tokens are 1h. Impersonation is a sensitive operation.
   - What's unclear: Whether 1h is acceptable or should be shorter (e.g., 30 min).
   - Recommendation: Use 1h to match existing tokens. The impersonation token is audited on every action, and the super admin can exit at any time. A shorter TTL would require implementing refresh for impersonation tokens, adding complexity.

2. **Should the super admin be able to impersonate a specific admin, or always the "first" admin of the tenant?**
   - What we know: IMPR-01 says "impersonate a tenant's admin." Most tenants likely have one admin.
   - What's unclear: If a tenant has multiple admins, which one?
   - Recommendation: Start with the first active admin found (simplest). The API accepts a `tenantId`, not a `teacherId`. If multiple admins exist, pick the first one. This can be enhanced later to allow choosing a specific admin.

3. **Should impersonation audit entries use the existing `platform_audit_log` or a new collection?**
   - What we know: `platform_audit_log` already stores super admin actions. It has `action`, `actorId`, `targetId`, `details`, `timestamp`.
   - What's unclear: Whether mixing impersonation-action logs with tenant-lifecycle logs is desirable.
   - Recommendation: Use `platform_audit_log` for START/STOP events. For per-request audit during impersonation, log to the same collection with a distinct action type (`IMPERSONATION_ACTION`). This keeps all super admin audit in one queryable collection.

4. **How does the frontend handle `checkAuthStatus` during impersonation on page refresh?**
   - What we know: `checkAuthStatus` reads `loginType` from localStorage and validates the token.
   - What's unclear: The exact flow for `loginType === 'impersonation'`.
   - Recommendation: When `loginType === 'impersonation'`, validate the token against `/api/auth/validate` (regular auth endpoint, since the impersonation token is a valid teacher JWT). Restore the impersonation context from `localStorage.getItem('impersonationContext')`. If validation fails, auto-exit impersonation and restore super admin state.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `middleware/auth.middleware.js` -- existing `authenticateToken` middleware (verified line-by-line)
- Codebase analysis: `middleware/tenant.middleware.js` -- `buildContext`, `enforceTenant`, `stripTenantId`
- Codebase analysis: `api/auth/auth.service.js` -- `generateAccessToken` JWT payload structure
- Codebase analysis: `api/super-admin/super-admin.service.js` -- super admin JWT structure with `type: 'super_admin'`
- Codebase analysis: `services/auditTrail.service.js` -- audit logging schema and defensive error handling
- Codebase analysis: `server.js` -- middleware chain for all tenant-scoped routes
- Codebase analysis: Frontend `src/services/authContext.jsx` -- `loginType` differentiation, `loginAsSuperAdmin`, token storage
- Codebase analysis: Frontend `src/services/apiService.js` -- `ApiClient.setToken`, `getStoredToken`, `removeToken`
- Codebase analysis: `config/constants.js` -- `AUDIT_ACTIONS`, `COLLECTIONS`

### Secondary (MEDIUM confidence)
- [OneUptime Impersonation Implementation Guide (2026-01-30)](https://oneuptime.com/blog/post/2026-01-30-impersonation-implementation/view) -- JWT token design, dual-identity pattern, session management, frontend banner approach
- [Authress Knowledge Base: Risks of User Impersonation](https://authress.io/knowledge-base/academy/topics/user-impersonation-risks) -- Transparency, audit requirements, permission restrictions
- [RFC 8693 - OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) -- `act` claim standard for delegation chains (informational, not implementing full RFC)
- [ZITADEL: Token Exchange for Impersonation](https://zitadel.com/docs/guides/integrate/token-exchange) -- Impersonation vs delegation distinction

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- impersonation token design verified against existing `authenticateToken` and `generateAccessToken`; middleware chain fully understood from `server.js`
- Pitfalls: HIGH -- all pitfalls derived from actual codebase analysis (localStorage collision, loginType check, tenant.isActive gate, school year resolution)
- Frontend: HIGH -- authContext.jsx, apiService.js, and localStorage patterns fully analyzed

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable architecture, no fast-moving dependencies)
