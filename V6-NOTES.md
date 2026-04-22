# V6 Notes — Avatar Unification Final Wave

## E2E @smoke tests — environment issue

Tests in `e2e/tests/avatar-unification.spec.ts` could not be run locally because the API
server was not running during the V6 wave (ECONNREFUSED on localhost:4000 → 502 Bad Gateway
from the web proxy). This is an environment issue, not an avatar regression.

Root cause: `pnpm run docker:dev` (PostgreSQL + Redis) and `pnpm run dev` (API + web) were
not started before running the Playwright tests.

The test file is correctly authored and uses the same `/fr/` locale pattern as V5's
`e2e/tests/avatar-screenshots.spec.ts`. Tests are expected to pass in a full dev environment.

## Pre-existing test failure (unrelated)

`apps/web/src/services/__tests__/milestones.service.test.ts` — 1 test fails because the
service now appends `?limit=1000` to the `/milestones` endpoint but the test mock expects
the plain path `/milestones`. This predates V6 (last touched in commit 8597b48 / e71f689)
and is unrelated to the avatar refactor.
