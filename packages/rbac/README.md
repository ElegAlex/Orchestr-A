# `@orchestra/rbac`

Compile-time RBAC: 117 atomic permissions, 26 role templates, zero DB lookup
for permission resolution. Resolved by `ROLE_TEMPLATES[templateKey].permissions`
in `apps/api/src/rbac/permissions.service.ts`.

## Where permissions live

```
atomic-permissions.ts
  ├── PermissionCode (union type — exhaustive, sorted alphabetically)
  ├── CATALOG_PERMISSIONS (the 117 codes, also alphabetical)
  └── Bundles (PROJECTS_CRUD, LEAVES_GLOBAL, …)

templates.ts
  ├── RoleTemplateKey (the 26 template keys)
  └── ROLE_TEMPLATES[key].permissions = composed from bundles or catalog
```

A _bundle_ is a named subset of permissions reused across templates
(`PROJECTS_CRUD`, `LEAVES_GLOBAL`, etc.). A _template_ is the final
permission list a role inherits.

## When to add a bundle vs grant directly via `CATALOG_PERMISSIONS`

The rule: **only create a bundle when at least two templates need the same
subset and none of them inherit it via `CATALOG_PERMISSIONS`.** Otherwise the
bundle is dead code — visible in the file, not referenced anywhere — and
misleads future maintainers.

Two paths exist for distributing a permission:

1. **Via `CATALOG_PERMISSIONS` inheritance.** ADMIN's permissions are exactly
   `CATALOG_PERMISSIONS`; ADMIN_DELEGATED is `without(CATALOG_PERMISSIONS, [...])`.
   Any permission listed in `CATALOG_PERMISSIONS` automatically lands on both
   unless explicitly excluded. This is the path for permissions that should
   reach every administrative-tier template by default.

2. **Via a named bundle imported into specific templates.** Used when the
   permission must be granted to non-administrative templates (MANAGER,
   PORTFOLIO_MANAGER, etc.) whose `permissions` arrays are explicit lists.

### Example — `leaves:self_approve` (introduced 2026-05-23)

Spec: only ADMIN and RESPONSABLE auto-validate their own leaves. RESPONSABLE
maps to ADMIN_DELEGATED (`templates.ts:1039 — RESPONSABLE: "ADMIN_DELEGATED"`),
and `leaves:self_approve` is not in ADMIN_DELEGATED's exclusion list. The
permission therefore reaches both templates via path 1.

The first draft of the feature also exported a `LEAVES_SELF_APPROVE` bundle
"for clarity". It was never imported. Wave 4 of the uniform-leave-balance
remediation removed it — the bundle was misleading dead weight, and worse,
risked nudging a future maintainer toward adding the code to ADMIN_DELEGATED's
exclusion list (silently stripping the permission from RESPONSABLE, since the
only delivery path was catalog membership).

If `leaves:self_approve` ever needs to land on a non-catalog template (e.g.,
PORTFOLIO_MANAGER), reintroduce the bundle and add it to that template's
explicit list — not before.

## Adding a permission

1. Add the new code to the `PermissionCode` union in
   `atomic-permissions.ts`, alphabetically within its module group.
2. Add the same code to `CATALOG_PERMISSIONS`, alphabetically.
3. Update `CATALOG_PERMISSIONS contient N permissions` in both
   `packages/rbac/__tests__/templates.spec.ts` and
   `apps/api/src/rbac/__tests__/permissions.service.spec.ts`.
4. Update `EXPECTED_COUNTS` in `templates.spec.ts` for every template
   that gains or loses the permission. ADMIN gains every catalog
   addition by definition; ADMIN_DELEGATED gains it unless excluded.
5. If the permission needs to reach a non-catalog template, add a
   bundle and import it from that template — do not duplicate the code
   string across multiple template files.
6. After deploying RBAC template changes, purge Redis
   `role-permissions:*` keys so guards re-resolve the new templates.

## Why no DB table for permissions

Historically `role_permissions` was a DB table; Wave V4 removed it
(2026-04-20). Permissions are now resolved at compile time from the static
`ROLE_TEMPLATES` constant. Benefits: no DB round-trip per request, no risk
of seed drift, type-checked at build, IDE autocompletion. Trade-off:
templates change only via a deploy. That trade-off is intentional — see
`docs/superpowers/specs/2026-04-09-rbac-v4-templates.md`.
