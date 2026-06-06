import * as path from "path";

export const ROLES = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
  "observateur",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_EMAILS: Record<Role, string> = {
  admin: "admin-test@orchestr-a.test",
  responsable: "responsable-test@orchestr-a.test",
  manager: "manager-test@orchestr-a.test",
  referent: "referent-test@orchestr-a.test",
  contributeur: "contributeur-test@orchestr-a.test",
  observateur: "observateur-test@orchestr-a.test",
};

export const ROLE_LOGINS: Record<Role, string> = {
  admin: "admin-test",
  responsable: "responsable-test",
  manager: "manager-test",
  referent: "referent-test",
  contributeur: "contributeur-test",
  observateur: "observateur-test",
};

// Anchor at the repo root (this file lives in <root>/e2e/fixtures) so the
// storage states are written to the SAME place the Playwright config reads
// them from, regardless of the process cwd. Without this, `pnpm --filter web
// exec playwright` (cwd = apps/web) wrote states to apps/web/playwright/.auth/
// while the role projects read <root>/playwright/.auth/ — using stale states.
const AUTH_DIR = path.resolve(__dirname, "..", "..", "playwright", ".auth");

export const ROLE_STORAGE_PATHS: Record<Role, string> = {
  admin: path.join(AUTH_DIR, "admin.json"),
  responsable: path.join(AUTH_DIR, "responsable.json"),
  manager: path.join(AUTH_DIR, "manager.json"),
  referent: path.join(AUTH_DIR, "referent.json"),
  contributeur: path.join(AUTH_DIR, "contributeur.json"),
  observateur: path.join(AUTH_DIR, "observateur.json"),
};

export const ROLE_PASSWORD = "Test1234!";
