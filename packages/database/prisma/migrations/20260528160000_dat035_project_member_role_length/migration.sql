-- DAT-035 — structural floor on `project_members.role` (length bounds only).
--
-- The audit declined a closed enum / native PG enum / CHECK-against-list because the
-- value space is GENUINELY OPEN: 5 distinct values on dev (`Chef de projet` 2944,
-- `Membre` 12, plus 3 sparse institutional one-offs `Responsable infra` / `Référente
-- support` / `Lead dev`). Per-collectivité variations are the design intent — SEC-002 /
-- [[project_responsable_scope_perimeter]] precedent. DAT-012's bail on this column
-- documented exactly that.
--
-- Closing as Option (a)+dead-code (operator-decided 2026-05-28, see BACKLOG DAT-035
-- Learnings): the DB CHECK below is the structural floor (non-empty, bounded length);
-- the DTO `AddMemberDto` / `UpdateMemberDto` carries the layer-of-rejection partner
-- (trim + length, returns 400); the `OwnershipService.PROJECT_LEADER_MEMBER_ROLES`
-- UPPERCASE codes `OWNER` / `LEAD` (which matched ZERO rows — vestigial enum-style
-- code that never materialized) are removed in the same commit. The three changes
-- are coordinated: the dead-code removal is in scope because it's the exact artifact
-- of the abandoned closed-set idea this task replaces.
--
-- Pre-flight (dev DB :5433, 2026-05-28):
--   - role NOT NULL at the schema level → CHECK does not need an IS NULL guard.
--   - char_length(role): min 6 (`Membre`), max 17 (`Référente support`).
--   - 0 nulls / 0 empties / 0 whitespace-only across 2959 rows → CHECK validates clean.
--   - Chosen upper bound: 100 — round number, ~5.8x current max, generous headroom for
--     plausible per-collectivité titles ("Responsable de la transformation numérique"
--     ≈ 47 chars) without restricting legitimate variation.
--
-- Whitespace-only is NOT rejected by the CHECK below (`char_length('   ')` = 3 ≥ 1).
-- That's intentional: the DTO normalization trims at the application layer (every
-- legitimate write goes through it), and the CHECK stays a simple length predicate
-- — the cleanest layer-of-rejection split. A direct admin SQL write of '   ' would
-- pass the CHECK but is out of normal traffic; if it became a real concern, a
-- companion `length(btrim(role)) >= 1` could be added later (not now — scope).
--
-- CHECK is not expressible in the Prisma 6 DSL, so this migration is hand-authored
-- raw SQL (DAT-003/004 precedent). schema.prisma is intentionally unchanged.

ALTER TABLE "project_members"
  ADD CONSTRAINT "project_members_role_length_ck"
  CHECK (char_length("role") BETWEEN 1 AND 100);
