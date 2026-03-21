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

export const ROLE_STORAGE_PATHS: Record<Role, string> = {
  admin: path.join("playwright", ".auth", "admin.json"),
  responsable: path.join("playwright", ".auth", "responsable.json"),
  manager: path.join("playwright", ".auth", "manager.json"),
  referent: path.join("playwright", ".auth", "referent.json"),
  contributeur: path.join("playwright", ".auth", "contributeur.json"),
  observateur: path.join("playwright", ".auth", "observateur.json"),
};

export const ROLE_PASSWORD = "Test1234!";
