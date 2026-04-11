// ============================================================
// Targeted RBAC seed entry point — prod-safe.
// Runs ONLY the permissions + roles + Redis flush block,
// skipping the demo-data sections of the full seed.ts.
// Use via: pnpm --filter database run db:seed:permissions
// ============================================================
import { PrismaClient } from "@prisma/client";
import { seedPermissionsAndRoles } from "./seed";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding RBAC permissions & roles only...");
  await seedPermissionsAndRoles(prisma);
  console.log("🎉 RBAC seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding RBAC:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
