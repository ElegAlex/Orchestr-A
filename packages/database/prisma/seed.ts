import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ============================================================
// V0 RBAC refactor — Seed des 26 rôles templates système
// ============================================================
// Idempotent (upsert sur `code`). Ne touche jamais aux rôles custom
// (isSystem=false) ni aux users existants. Cf. contract-02 / contract-03 §9.
//
// Note : la migration `20260419192835_rbac_v0_add_roles_table` insère
// déjà les 26 rôles via SQL pur. Cette fonction est le filet idempotent
// au cas où le seed serait lancé seul (dev fresh DB) ou où on aurait
// besoin de re-synchroniser les labels par défaut après un éventuel
// drift manuel en DB.
//
// L'admin peut éditer le `label` d'un rôle système via l'UI ; le seed
// NE LE RÉÉCRASE PAS (priorité label DB > label par défaut).

const SYSTEM_ROLE_TEMPLATES: Array<{
  code: string;
  label: string;
  templateKey: string;
  isDefault: boolean;
}> = [
  {
    code: "ADMIN",
    label: "Administrateur",
    templateKey: "ADMIN",
    isDefault: false,
  },
  {
    code: "ADMIN_DELEGATED",
    label: "Directeur adjoint",
    templateKey: "ADMIN_DELEGATED",
    isDefault: false,
  },
  {
    code: "PORTFOLIO_MANAGER",
    label: "Manager de portefeuille",
    templateKey: "PORTFOLIO_MANAGER",
    isDefault: false,
  },
  {
    code: "MANAGER",
    label: "Manager",
    templateKey: "MANAGER",
    isDefault: false,
  },
  {
    code: "MANAGER_PROJECT_FOCUS",
    label: "Manager projet",
    templateKey: "MANAGER_PROJECT_FOCUS",
    isDefault: false,
  },
  {
    code: "MANAGER_HR_FOCUS",
    label: "Chef de service",
    templateKey: "MANAGER_HR_FOCUS",
    isDefault: false,
  },
  {
    code: "PROJECT_LEAD",
    label: "Chef de projet",
    templateKey: "PROJECT_LEAD",
    isDefault: false,
  },
  {
    code: "PROJECT_LEAD_JUNIOR",
    label: "Chef de projet junior",
    templateKey: "PROJECT_LEAD_JUNIOR",
    isDefault: false,
  },
  {
    code: "TECHNICAL_LEAD",
    label: "Référent technique",
    templateKey: "TECHNICAL_LEAD",
    isDefault: false,
  },
  {
    code: "PROJECT_CONTRIBUTOR",
    label: "Contributeur projet",
    templateKey: "PROJECT_CONTRIBUTOR",
    isDefault: false,
  },
  {
    code: "PROJECT_CONTRIBUTOR_LIGHT",
    label: "Contributeur projet junior",
    templateKey: "PROJECT_CONTRIBUTOR_LIGHT",
    isDefault: false,
  },
  {
    code: "FUNCTIONAL_REFERENT",
    label: "Référent fonctionnel",
    templateKey: "FUNCTIONAL_REFERENT",
    isDefault: false,
  },
  {
    code: "HR_OFFICER",
    label: "Gestionnaire RH",
    templateKey: "HR_OFFICER",
    isDefault: false,
  },
  {
    code: "HR_OFFICER_LIGHT",
    label: "Assistant RH",
    templateKey: "HR_OFFICER_LIGHT",
    isDefault: false,
  },
  {
    code: "THIRD_PARTY_MANAGER",
    label: "Gestionnaire prestataires",
    templateKey: "THIRD_PARTY_MANAGER",
    isDefault: false,
  },
  {
    code: "CONTROLLER",
    label: "Contrôleur de gestion",
    templateKey: "CONTROLLER",
    isDefault: false,
  },
  {
    code: "BUDGET_ANALYST",
    label: "Analyste budgétaire",
    templateKey: "BUDGET_ANALYST",
    isDefault: false,
  },
  {
    code: "DATA_ANALYST",
    label: "Analyste données",
    templateKey: "DATA_ANALYST",
    isDefault: false,
  },
  {
    code: "IT_SUPPORT",
    label: "Technicien support",
    templateKey: "IT_SUPPORT",
    isDefault: false,
  },
  {
    code: "IT_INFRASTRUCTURE",
    label: "Équipe infrastructure",
    templateKey: "IT_INFRASTRUCTURE",
    isDefault: false,
  },
  {
    code: "OBSERVER_FULL",
    label: "Observateur global",
    templateKey: "OBSERVER_FULL",
    isDefault: false,
  },
  {
    code: "OBSERVER_PROJECTS_ONLY",
    label: "Sponsor projet",
    templateKey: "OBSERVER_PROJECTS_ONLY",
    isDefault: false,
  },
  {
    code: "OBSERVER_HR_ONLY",
    label: "Audit social",
    templateKey: "OBSERVER_HR_ONLY",
    isDefault: false,
  },
  {
    code: "BASIC_USER",
    label: "Utilisateur standard",
    templateKey: "BASIC_USER",
    isDefault: true,
  },
  {
    code: "EXTERNAL_PRESTATAIRE",
    label: "Prestataire externe",
    templateKey: "EXTERNAL_PRESTATAIRE",
    isDefault: false,
  },
  {
    code: "STAGIAIRE_ALTERNANT",
    label: "Stagiaire / alternant",
    templateKey: "STAGIAIRE_ALTERNANT",
    isDefault: false,
  },
];

export async function seedSystemRoleTemplates(
  prisma: PrismaClient,
): Promise<void> {
  let created = 0;
  let preserved = 0;
  for (const tpl of SYSTEM_ROLE_TEMPLATES) {
    const existing = await prisma.role.findUnique({
      where: { code: tpl.code },
    });
    if (existing) {
      // Préserve label custom + isDefault DB. Réaligne uniquement templateKey
      // si drift (cas re-seed après changement contrat).
      if (existing.templateKey !== tpl.templateKey) {
        await prisma.role.update({
          where: { code: tpl.code },
          data: { templateKey: tpl.templateKey, isSystem: true },
        });
      }
      preserved++;
    } else {
      await prisma.role.create({
        data: {
          code: tpl.code,
          label: tpl.label,
          templateKey: tpl.templateKey,
          isSystem: true,
          isDefault: tpl.isDefault,
        },
      });
      created++;
    }
  }
  console.log(
    `[SEED RBAC V0] system roles : ${created} créés, ${preserved} préservés (total attendu : 26)`,
  );
}

async function main() {
  console.log("🌱 Seeding database...");

  // V0 RBAC : assurer la présence des 26 rôles templates système.
  await seedSystemRoleTemplates(prisma);

  // RBAC V4 : les users référencent Role via roleId. On charge la map
  // code → id depuis les rôles système créés juste au-dessus, pour que
  // tous les user.upsert/create puissent faire `roleId: roleIdByCode("X")`.
  const allRoles = await prisma.role.findMany({
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(allRoles.map((r) => [r.code, r.id]));
  const requireRoleId = (code: string): string => {
    const id = roleIdByCode.get(code);
    if (!id) {
      throw new Error(
        `[SEED] Role '${code}' introuvable en DB — seedSystemRoleTemplates a-t-il tourné ?`,
      );
    }
    return id;
  };

  // Create or get admin user — SEC-02: env-gated, no hardcoded default password
  const envAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const isProd = process.env.NODE_ENV === "production";

  let admin: Awaited<ReturnType<typeof prisma.user.upsert>> | null = null;

  if (isProd && !envAdminPassword) {
    console.warn(
      "[SEED] SKIPPED admin user — set SEED_ADMIN_PASSWORD to enable.",
    );
  } else {
    let plaintextPassword: string;
    let forcePasswordChange: boolean;

    if (envAdminPassword) {
      plaintextPassword = envAdminPassword;
      forcePasswordChange = false;
    } else {
      plaintextPassword = crypto.randomBytes(18).toString("base64url");
      forcePasswordChange = true;
      console.log(
        "============================================================\n" +
          `[SEED] Generated admin password: ${plaintextPassword}\n` +
          "[SEED] Save it now — it will not be shown again.\n" +
          "============================================================",
      );
    }

    const passwordHash = await bcrypt.hash(plaintextPassword, 12);

    admin = await prisma.user.upsert({
      where: { email: "admin@orchestr-a.internal" },
      update: {
        passwordHash,
        forcePasswordChange,
      },
      create: {
        email: "admin@orchestr-a.internal",
        login: "admin",
        passwordHash,
        firstName: "Admin",
        lastName: "System",
        roleId: requireRoleId("ADMIN"),
        isActive: true,
        forcePasswordChange,
      },
    });

    console.log("✅ Admin user ready:", admin.email);
  }

  if (!admin) {
    console.warn(
      "[SEED] Admin user not created — skipping demo data seed (prod mode without SEED_ADMIN_PASSWORD).",
    );
    return;
  }

  // Create or get department
  let department = await prisma.department.findFirst({
    where: { name: "Direction des Systèmes d'Information" },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        name: "Direction des Systèmes d'Information",
        description: "Département DSI",
      },
    });
  }

  console.log("✅ Department ready:", department.name);

  // Create or get services
  let serviceHelpdesk = await prisma.service.findFirst({
    where: { name: "Service Helpdesk" },
  });

  if (!serviceHelpdesk) {
    serviceHelpdesk = await prisma.service.create({
      data: {
        name: "Service Helpdesk",
        description: "Support utilisateur et assistance technique",
        departmentId: department.id,
      },
    });
  }

  let serviceAdminSys = await prisma.service.findFirst({
    where: { name: "Service Administration Système" },
  });

  if (!serviceAdminSys) {
    serviceAdminSys = await prisma.service.create({
      data: {
        name: "Service Administration Système",
        description: "Gestion des infrastructures et systèmes",
        departmentId: department.id,
      },
    });
  }

  let serviceDev = await prisma.service.findFirst({
    where: { name: "Service Développement" },
  });

  if (!serviceDev) {
    serviceDev = await prisma.service.create({
      data: {
        name: "Service Développement",
        description: "Développement d'applications et logiciels",
        departmentId: department.id,
      },
    });
  }

  console.log(
    "✅ Services ready:",
    serviceHelpdesk.name,
    serviceAdminSys.name,
    serviceDev.name,
  );

  // Create or get Helpdesk employees
  const helpdeskEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: "sophie.martin@orchestr-a.internal" },
      update: {},
      create: {
        email: "sophie.martin@orchestr-a.internal",
        login: "smartin",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Sophie",
        lastName: "Martin",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "thomas.bernard@orchestr-a.internal" },
      update: {},
      create: {
        email: "thomas.bernard@orchestr-a.internal",
        login: "tbernard",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Thomas",
        lastName: "Bernard",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "julie.dubois@orchestr-a.internal" },
      update: {},
      create: {
        email: "julie.dubois@orchestr-a.internal",
        login: "jdubois",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Julie",
        lastName: "Dubois",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "nicolas.rousseau@orchestr-a.internal" },
      update: {},
      create: {
        email: "nicolas.rousseau@orchestr-a.internal",
        login: "nrousseau",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Nicolas",
        lastName: "Rousseau",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "marie.lefevre@orchestr-a.internal" },
      update: {},
      create: {
        email: "marie.lefevre@orchestr-a.internal",
        login: "mlefevre",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Marie",
        lastName: "Lefevre",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Helpdesk employees to service
  await Promise.all(
    helpdeskEmployees.map((emp) =>
      prisma.userService.upsert({
        where: {
          userId_serviceId: {
            userId: emp.id,
            serviceId: serviceHelpdesk.id,
          },
        },
        update: {},
        create: {
          userId: emp.id,
          serviceId: serviceHelpdesk.id,
        },
      }),
    ),
  );

  console.log("✅ 5 Helpdesk employees ready");

  // Create or get Admin Sys employees
  const adminSysEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: "pierre.moreau@orchestr-a.internal" },
      update: {},
      create: {
        email: "pierre.moreau@orchestr-a.internal",
        login: "pmoreau",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Pierre",
        lastName: "Moreau",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "isabelle.simon@orchestr-a.internal" },
      update: {},
      create: {
        email: "isabelle.simon@orchestr-a.internal",
        login: "isimon",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Isabelle",
        lastName: "Simon",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "laurent.michel@orchestr-a.internal" },
      update: {},
      create: {
        email: "laurent.michel@orchestr-a.internal",
        login: "lmichel",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Laurent",
        lastName: "Michel",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "celine.garcia@orchestr-a.internal" },
      update: {},
      create: {
        email: "celine.garcia@orchestr-a.internal",
        login: "cgarcia",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Céline",
        lastName: "Garcia",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "alexandre.roux@orchestr-a.internal" },
      update: {},
      create: {
        email: "alexandre.roux@orchestr-a.internal",
        login: "aroux",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Alexandre",
        lastName: "Roux",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Admin Sys employees to service
  await Promise.all(
    adminSysEmployees.map((emp) =>
      prisma.userService.upsert({
        where: {
          userId_serviceId: {
            userId: emp.id,
            serviceId: serviceAdminSys.id,
          },
        },
        update: {},
        create: {
          userId: emp.id,
          serviceId: serviceAdminSys.id,
        },
      }),
    ),
  );

  console.log("✅ 5 Admin Sys employees ready");

  // Create or get Developer employees
  const devEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: "emma.petit@orchestr-a.internal" },
      update: {},
      create: {
        email: "emma.petit@orchestr-a.internal",
        login: "epetit",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Emma",
        lastName: "Petit",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "maxime.durand@orchestr-a.internal" },
      update: {},
      create: {
        email: "maxime.durand@orchestr-a.internal",
        login: "mdurand",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Maxime",
        lastName: "Durand",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "camille.laurent@orchestr-a.internal" },
      update: {},
      create: {
        email: "camille.laurent@orchestr-a.internal",
        login: "claurent",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Camille",
        lastName: "Laurent",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "hugo.girard@orchestr-a.internal" },
      update: {},
      create: {
        email: "hugo.girard@orchestr-a.internal",
        login: "hgirard",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Hugo",
        lastName: "Girard",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "lea.fontaine@orchestr-a.internal" },
      update: {},
      create: {
        email: "lea.fontaine@orchestr-a.internal",
        login: "lfontaine",
        passwordHash:
          "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG",
        firstName: "Léa",
        lastName: "Fontaine",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Developer employees to service
  await Promise.all(
    devEmployees.map((emp) =>
      prisma.userService.upsert({
        where: {
          userId_serviceId: {
            userId: emp.id,
            serviceId: serviceDev.id,
          },
        },
        update: {},
        create: {
          userId: emp.id,
          serviceId: serviceDev.id,
        },
      }),
    ),
  );

  console.log("✅ 5 Developer employees ready");

  // Create a test project
  const project = await prisma.project.create({
    data: {
      name: "Projet de test",
      description: "Premier projet de test",
      status: "ACTIVE",
      priority: "NORMAL",
      startDate: new Date(),
      budgetHours: 100,
    },
  });

  console.log("✅ Project created:", project.name);

  // ============================================================
  // Projet réaliste : Migration SI Collectivité
  // Du 13/01/2026 au 30/04/2026, 30 tâches, 4 jalons
  // ============================================================

  const allUsers = [
    admin,
    ...helpdeskEmployees,
    ...adminSysEmployees,
    ...devEmployees,
  ];

  let migrationProject = await prisma.project.findFirst({
    where: { name: "Migration SI - Collectivité Grand Lyon" },
  });

  if (!migrationProject) {
    migrationProject = await prisma.project.create({
      data: {
        name: "Migration SI - Collectivité Grand Lyon",
        description:
          "Projet de migration du système d'information de la collectivité vers une infrastructure modernisée. Inclut la refonte des applicatifs métier, la migration des données et la formation des agents.",
        status: "ACTIVE",
        priority: "HIGH",
        startDate: new Date("2026-01-13"),
        endDate: new Date("2026-04-30"),
        budgetHours: 2400,
        createdById: admin.id,
        managerId: admin.id,
        sponsorId: helpdeskEmployees[0]?.id,
        icon: "\u{1F680}",
      },
    });
  }

  // Add project members
  const memberRoles = [
    { user: admin, role: "Chef de projet" },
    { user: helpdeskEmployees[0], role: "Référente support" },
    { user: helpdeskEmployees[1], role: "Membre" },
    { user: adminSysEmployees[0], role: "Responsable infra" },
    { user: adminSysEmployees[1], role: "Membre" },
    { user: adminSysEmployees[2], role: "Membre" },
    { user: devEmployees[0], role: "Lead dev" },
    { user: devEmployees[1], role: "Membre" },
    { user: devEmployees[2], role: "Membre" },
    { user: devEmployees[3], role: "Membre" },
  ];

  await Promise.all(
    memberRoles.map(({ user, role }) =>
      prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: migrationProject.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          projectId: migrationProject.id,
          userId: user.id,
          role,
        },
      }),
    ),
  );

  console.log("✅ Migration SI project + 10 members ready");

  // 4 Milestones
  const milestones = await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Audit & Cadrage terminé",
        description:
          "Audit complet de l'existant et validation du plan de migration",
        projectId: migrationProject.id,
        dueDate: new Date("2026-02-06"),
        status: "COMPLETED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Infrastructure cible opérationnelle",
        description:
          "Nouvelle infrastructure déployée et validée (serveurs, réseau, sécurité)",
        projectId: migrationProject.id,
        dueDate: new Date("2026-03-06"),
        status: "IN_PROGRESS",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Migration données & applicatifs",
        description:
          "Toutes les données et applications métier migrées et testées",
        projectId: migrationProject.id,
        dueDate: new Date("2026-04-03"),
        status: "PENDING",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Déploiement & Formation terminés",
        description:
          "Mise en production, formation des agents et clôture du projet",
        projectId: migrationProject.id,
        dueDate: new Date("2026-04-30"),
        status: "PENDING",
      },
    }),
  ]);

  console.log("✅ 4 milestones created");

  // ============================================================
  // Projets supplémentaires pour le Gantt Portfolio
  // ============================================================

  const extraProjects = await Promise.all([
    prisma.project.upsert({
      where: { id: "00000000-0000-0000-0000-000000000010" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000010",
        name: "Refonte Portail Citoyen",
        description: "Modernisation du portail web des services aux citoyens",
        status: "ACTIVE",
        priority: "CRITICAL",
        startDate: new Date("2026-01-06"),
        endDate: new Date("2026-07-31"),
        budgetHours: 3200,
        createdById: admin.id,
        managerId: admin.id,
        icon: "\u{1F310}",
      },
    }),
    prisma.project.upsert({
      where: { id: "00000000-0000-0000-0000-000000000011" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000011",
        name: "Déploiement RGPD - Mise en conformité",
        description: "Audit et mise en conformité RGPD de tous les traitements",
        status: "ACTIVE",
        priority: "HIGH",
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-06-30"),
        budgetHours: 800,
        createdById: admin.id,
        managerId: admin.id,
        icon: "\u{1F512}",
      },
    }),
    prisma.project.upsert({
      where: { id: "00000000-0000-0000-0000-000000000012" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000012",
        name: "Fibre optique - Interconnexion sites",
        description:
          "Déploiement fibre optique entre les 12 sites de la collectivité",
        status: "ACTIVE",
        priority: "NORMAL",
        startDate: new Date("2025-11-01"),
        endDate: new Date("2026-05-15"),
        budgetHours: 1600,
        createdById: admin.id,
        managerId: admin.id,
        icon: "\u{1F4E1}",
      },
    }),
    prisma.project.upsert({
      where: { id: "00000000-0000-0000-0000-000000000013" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000013",
        name: "GED - Dématérialisation courrier",
        description:
          "Mise en place de la GED pour la dématérialisation du courrier entrant/sortant",
        status: "DRAFT",
        priority: "NORMAL",
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-12-31"),
        budgetHours: 1200,
        createdById: admin.id,
        managerId: admin.id,
        icon: "\u{1F4C4}",
      },
    }),
    prisma.project.upsert({
      where: { id: "00000000-0000-0000-0000-000000000014" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000014",
        name: "Supervision réseau - Nagios \u2192 Zabbix",
        description: "Migration de l'outil de supervision réseau",
        status: "SUSPENDED",
        priority: "LOW",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-03-31"),
        budgetHours: 400,
        createdById: admin.id,
        managerId: admin.id,
        icon: "\u{1F4CA}",
      },
    }),
  ]);

  // Membres pour les projets supplémentaires
  for (const ep of extraProjects) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: ep.id, userId: admin.id } },
      update: {},
      create: {
        projectId: ep.id,
        userId: admin.id,
        role: "Chef de projet",
        allocation: 30,
      },
    });
  }

  console.log(`✅ ${extraProjects.length} extra projects created`);

  // Jalons pour "Projet de test"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Cahier des charges validé",
        projectId: project.id,
        dueDate: new Date("2026-04-10"),
        status: "PENDING",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Livraison MVP",
        projectId: project.id,
        dueDate: new Date("2026-05-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Jalons pour "Refonte Portail Citoyen"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Maquettes UX validées",
        projectId: extraProjects[0].id,
        dueDate: new Date("2026-02-14"),
        status: "COMPLETED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "API backend v1 livrée",
        projectId: extraProjects[0].id,
        dueDate: new Date("2026-03-28"),
        status: "IN_PROGRESS",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Recette usagers pilotes",
        projectId: extraProjects[0].id,
        dueDate: new Date("2026-05-30"),
        status: "PENDING",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Mise en production",
        projectId: extraProjects[0].id,
        dueDate: new Date("2026-07-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Jalons pour "RGPD"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Cartographie des traitements",
        projectId: extraProjects[1].id,
        dueDate: new Date("2026-03-01"),
        status: "COMPLETED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "PIA réalisés",
        projectId: extraProjects[1].id,
        dueDate: new Date("2026-04-15"),
        status: "IN_PROGRESS",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Registre des traitements publié",
        projectId: extraProjects[1].id,
        dueDate: new Date("2026-06-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Jalons pour "Fibre optique"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Étude de faisabilité terminée",
        projectId: extraProjects[2].id,
        dueDate: new Date("2025-12-15"),
        status: "COMPLETED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Travaux de génie civil achevés",
        projectId: extraProjects[2].id,
        dueDate: new Date("2026-03-01"),
        status: "COMPLETED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "6 premiers sites raccordés",
        projectId: extraProjects[2].id,
        dueDate: new Date("2026-03-31"),
        status: "DELAYED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "12 sites raccordés - Réception finale",
        projectId: extraProjects[2].id,
        dueDate: new Date("2026-05-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Jalons pour "GED"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Choix de la solution",
        projectId: extraProjects[3].id,
        dueDate: new Date("2026-06-15"),
        status: "PENDING",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Déploiement pilote",
        projectId: extraProjects[3].id,
        dueDate: new Date("2026-09-30"),
        status: "PENDING",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Généralisation tous services",
        projectId: extraProjects[3].id,
        dueDate: new Date("2026-12-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Jalons pour "Supervision réseau"
  await Promise.all([
    prisma.milestone.create({
      data: {
        name: "Zabbix installé et configuré",
        projectId: extraProjects[4].id,
        dueDate: new Date("2026-02-15"),
        status: "DELAYED",
      },
    }),
    prisma.milestone.create({
      data: {
        name: "Migration des sondes terminée",
        projectId: extraProjects[4].id,
        dueDate: new Date("2026-03-15"),
        status: "PENDING",
      },
    }),
  ]);

  // Tâches rapides pour donner de la progression aux projets
  const taskStatuses: Array<"DONE" | "IN_PROGRESS" | "TODO"> = [
    "DONE",
    "DONE",
    "DONE",
    "IN_PROGRESS",
    "TODO",
  ];
  for (const ep of extraProjects) {
    await Promise.all(
      taskStatuses.map((status, i) =>
        prisma.task.create({
          data: {
            title: `Tâche ${i + 1} - ${ep.name.substring(0, 20)}`,
            projectId: ep.id,
            status,
            priority: "NORMAL",
          },
        }),
      ),
    );
  }

  console.log("✅ Extra milestones & tasks seeded");

  // 3 Epics
  const epics = await Promise.all([
    prisma.epic.create({
      data: {
        name: "Phase 1 - Audit & Cadrage",
        description: "Cartographie SI, analyse des risques, plan de migration",
        projectId: migrationProject.id,
        progress: 100,
        startDate: new Date("2026-01-13"),
        endDate: new Date("2026-02-06"),
      },
    }),
    prisma.epic.create({
      data: {
        name: "Phase 2 - Infrastructure & Développement",
        description:
          "Mise en place infra cible, développement des adaptations applicatives",
        projectId: migrationProject.id,
        progress: 55,
        startDate: new Date("2026-02-09"),
        endDate: new Date("2026-03-20"),
      },
    }),
    prisma.epic.create({
      data: {
        name: "Phase 3 - Migration & Déploiement",
        description:
          "Migration des données, tests, formation et mise en production",
        projectId: migrationProject.id,
        progress: 10,
        startDate: new Date("2026-03-16"),
        endDate: new Date("2026-04-30"),
      },
    }),
  ]);

  console.log("✅ 3 epics created");

  // Helper to pick a user
  const u = (i: number) => allUsers[i % allUsers.length].id;

  // 30 Tasks across the 3 phases with realistic progression
  // Today is ~2026-02-17 so Phase 1 is done, Phase 2 in progress, Phase 3 not started
  const tasksData: Array<{
    title: string;
    description: string;
    status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
    priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
    epicId: string;
    milestoneId: string;
    assigneeId: string;
    estimatedHours: number;
    progress: number;
    startDate: string;
    endDate: string;
  }> = [
    // === PHASE 1 — Audit & Cadrage (8 tâches, toutes DONE) ===
    {
      title: "Cartographie des applications existantes",
      description:
        "Recenser l'ensemble des applicatifs métier, leurs versions et interconnexions",
      status: "DONE",
      priority: "HIGH",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(0),
      estimatedHours: 40,
      progress: 100,
      startDate: "2026-01-13",
      endDate: "2026-01-19",
    },
    {
      title: "Inventaire des serveurs et équipements réseau",
      description:
        "Dresser l'inventaire complet de l'infrastructure physique et virtuelle",
      status: "DONE",
      priority: "HIGH",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(6),
      estimatedHours: 32,
      progress: 100,
      startDate: "2026-01-13",
      endDate: "2026-01-20",
    },
    {
      title: "Audit de sécurité du SI actuel",
      description:
        "Évaluation des vulnérabilités, conformité RGPD et recommandations",
      status: "DONE",
      priority: "CRITICAL",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(8),
      estimatedHours: 56,
      progress: 100,
      startDate: "2026-01-14",
      endDate: "2026-01-26",
    },
    {
      title: "Analyse des flux de données inter-applicatifs",
      description:
        "Cartographier tous les échanges de données entre applications métier",
      status: "DONE",
      priority: "NORMAL",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(11),
      estimatedHours: 24,
      progress: 100,
      startDate: "2026-01-19",
      endDate: "2026-01-26",
    },
    {
      title: "Évaluation des compétences internes",
      description:
        "Identifier les besoins en formation et les ressources disponibles",
      status: "DONE",
      priority: "NORMAL",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(1),
      estimatedHours: 16,
      progress: 100,
      startDate: "2026-01-20",
      endDate: "2026-01-26",
    },
    {
      title: "Rédaction du plan de migration",
      description:
        "Document de référence : planning, risques, budget, ressources, jalons",
      status: "DONE",
      priority: "HIGH",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(0),
      estimatedHours: 40,
      progress: 100,
      startDate: "2026-01-26",
      endDate: "2026-02-03",
    },
    {
      title: "Validation du budget par la direction",
      description: "Présentation et arbitrage budgétaire avec la DGS",
      status: "DONE",
      priority: "CRITICAL",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(0),
      estimatedHours: 8,
      progress: 100,
      startDate: "2026-02-03",
      endDate: "2026-02-05",
    },
    {
      title: "Sélection des prestataires externes",
      description:
        "Consultation et choix des partenaires pour l'hébergement et l'intégration",
      status: "DONE",
      priority: "HIGH",
      epicId: epics[0].id,
      milestoneId: milestones[0].id,
      assigneeId: u(0),
      estimatedHours: 24,
      progress: 100,
      startDate: "2026-01-27",
      endDate: "2026-02-06",
    },

    // === PHASE 2 — Infra & Dev (14 tâches, mix d'états) ===
    {
      title: "Provisionnement des nouveaux serveurs",
      description:
        "Installation et configuration des serveurs physiques et VMs pour l'environnement cible",
      status: "DONE",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(6),
      estimatedHours: 48,
      progress: 100,
      startDate: "2026-02-09",
      endDate: "2026-02-16",
    },
    {
      title: "Configuration réseau et firewall",
      description:
        "Mise en place des VLANs, règles firewall et VPN inter-sites",
      status: "DONE",
      priority: "CRITICAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(7),
      estimatedHours: 40,
      progress: 100,
      startDate: "2026-02-09",
      endDate: "2026-02-17",
    },
    {
      title: "Mise en place du cluster de bases de données",
      description:
        "Installation PostgreSQL haute disponibilité avec réplication et backup automatisé",
      status: "IN_REVIEW",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(8),
      estimatedHours: 56,
      progress: 85,
      startDate: "2026-02-10",
      endDate: "2026-02-24",
    },
    {
      title: "Déploiement de la plateforme de conteneurs",
      description:
        "Installation et configuration de Kubernetes pour les applicatifs conteneurisés",
      status: "IN_PROGRESS",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(6),
      estimatedHours: 64,
      progress: 60,
      startDate: "2026-02-12",
      endDate: "2026-02-27",
    },
    {
      title: "Adaptation du module GRH",
      description:
        "Refonte du module de gestion des ressources humaines pour compatibilité nouveau SI",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(11),
      estimatedHours: 80,
      progress: 45,
      startDate: "2026-02-10",
      endDate: "2026-03-06",
    },
    {
      title: "Adaptation du module Finances",
      description:
        "Migration des traitements comptables et interfaces avec la trésorerie",
      status: "IN_PROGRESS",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(12),
      estimatedHours: 96,
      progress: 35,
      startDate: "2026-02-12",
      endDate: "2026-03-13",
    },
    {
      title: "Développement des API d'intégration",
      description:
        "Création des connecteurs REST entre les applicatifs métier et le nouveau SI",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(13),
      estimatedHours: 72,
      progress: 25,
      startDate: "2026-02-16",
      endDate: "2026-03-13",
    },
    {
      title: "Mise en place du SSO / LDAP",
      description:
        "Configuration de l'authentification centralisée et annuaire unifié",
      status: "IN_PROGRESS",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(7),
      estimatedHours: 40,
      progress: 20,
      startDate: "2026-02-16",
      endDate: "2026-03-02",
    },
    {
      title: "Adaptation du module État Civil",
      description:
        "Migration du logiciel d'état civil et interconnexion COMEDEC",
      status: "TODO",
      priority: "NORMAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(14),
      estimatedHours: 64,
      progress: 0,
      startDate: "2026-02-23",
      endDate: "2026-03-13",
    },
    {
      title: "Configuration du monitoring et alerting",
      description:
        "Mise en place Prometheus/Grafana pour supervision de la nouvelle infrastructure",
      status: "TODO",
      priority: "NORMAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(8),
      estimatedHours: 32,
      progress: 0,
      startDate: "2026-02-25",
      endDate: "2026-03-06",
    },
    {
      title: "Tests d'intégration inter-modules",
      description:
        "Vérification du bon fonctionnement des échanges entre tous les modules adaptés",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(11),
      estimatedHours: 48,
      progress: 0,
      startDate: "2026-03-09",
      endDate: "2026-03-18",
    },
    {
      title: "Mise en place du plan de sauvegarde",
      description:
        "Stratégie de backup 3-2-1, tests de restauration, documentation PRA",
      status: "BLOCKED",
      priority: "CRITICAL",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(6),
      estimatedHours: 32,
      progress: 10,
      startDate: "2026-02-20",
      endDate: "2026-03-06",
    },
    {
      title: "Recette technique infrastructure",
      description:
        "Validation complète de l'infrastructure : performance, résilience, sécurité",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[1].id,
      milestoneId: milestones[1].id,
      assigneeId: u(0),
      estimatedHours: 24,
      progress: 0,
      startDate: "2026-03-16",
      endDate: "2026-03-20",
    },

    // === PHASE 3 — Migration & Déploiement (8 tâches, principalement TODO) ===
    {
      title: "Migration des données GRH",
      description:
        "Extraction, transformation et chargement des données RH vers le nouveau système",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[2].id,
      milestoneId: milestones[2].id,
      assigneeId: u(11),
      estimatedHours: 56,
      progress: 0,
      startDate: "2026-03-16",
      endDate: "2026-03-27",
    },
    {
      title: "Migration des données Finances",
      description:
        "Migration de l'historique comptable et des référentiels budgétaires",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[2].id,
      milestoneId: milestones[2].id,
      assigneeId: u(12),
      estimatedHours: 64,
      progress: 0,
      startDate: "2026-03-18",
      endDate: "2026-03-31",
    },
    {
      title: "Migration des données État Civil",
      description:
        "Migration des registres et interconnexion avec les services nationaux",
      status: "TODO",
      priority: "CRITICAL",
      epicId: epics[2].id,
      milestoneId: milestones[2].id,
      assigneeId: u(14),
      estimatedHours: 48,
      progress: 0,
      startDate: "2026-03-23",
      endDate: "2026-04-03",
    },
    {
      title: "Tests de non-régression complets",
      description:
        "Exécution du plan de tests sur l'ensemble des applicatifs migrés",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[2].id,
      milestoneId: milestones[3].id,
      assigneeId: u(13),
      estimatedHours: 72,
      progress: 0,
      startDate: "2026-03-30",
      endDate: "2026-04-10",
    },
    {
      title: "Formation des référents métier",
      description:
        "Sessions de formation pour les key users de chaque direction",
      status: "TODO",
      priority: "NORMAL",
      epicId: epics[2].id,
      milestoneId: milestones[3].id,
      assigneeId: u(1),
      estimatedHours: 40,
      progress: 0,
      startDate: "2026-04-06",
      endDate: "2026-04-17",
    },
    {
      title: "Formation des agents (vagues 1 à 3)",
      description:
        "Formations par groupes de 20 agents sur les nouveaux outils",
      status: "TODO",
      priority: "NORMAL",
      epicId: epics[2].id,
      milestoneId: milestones[3].id,
      assigneeId: u(2),
      estimatedHours: 60,
      progress: 0,
      startDate: "2026-04-13",
      endDate: "2026-04-24",
    },
    {
      title: "Bascule en production",
      description:
        "Coupure planifiée, bascule DNS, activation du nouveau SI, vérifications post-bascule",
      status: "TODO",
      priority: "CRITICAL",
      epicId: epics[2].id,
      milestoneId: milestones[3].id,
      assigneeId: u(0),
      estimatedHours: 16,
      progress: 0,
      startDate: "2026-04-25",
      endDate: "2026-04-27",
    },
    {
      title: "Hypercare et clôture projet",
      description:
        "Support renforcé post-bascule, résolution des incidents, bilan et retour d'expérience",
      status: "TODO",
      priority: "HIGH",
      epicId: epics[2].id,
      milestoneId: milestones[3].id,
      assigneeId: u(0),
      estimatedHours: 40,
      progress: 0,
      startDate: "2026-04-27",
      endDate: "2026-04-30",
    },
  ];

  await Promise.all(
    tasksData.map((t, i) =>
      prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId: migrationProject.id,
          epicId: t.epicId,
          milestoneId: t.milestoneId,
          assigneeId: t.assigneeId,
          estimatedHours: t.estimatedHours,
          progress: t.progress,
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
        },
      }),
    ),
  );

  console.log("✅ 30 tasks created for Migration SI project");

  // ============================================================
  // E2E TEST USERS — créés uniquement si E2E_SEED=true ou NODE_ENV=test
  // ============================================================
  if (process.env.E2E_SEED === "true" || process.env.NODE_ENV === "test") {
    console.log("🧪 E2E seed: creating test users...");

    // Département + service de test
    let testDepartment = await prisma.department.findFirst({
      where: { name: "Test Department" },
    });
    if (!testDepartment) {
      testDepartment = await prisma.department.create({
        data: {
          name: "Test Department",
          description: "Département dédié aux tests E2E",
        },
      });
    }

    let testService = await prisma.service.findFirst({
      where: { name: "Test Service" },
    });
    if (!testService) {
      testService = await prisma.service.create({
        data: {
          name: "Test Service",
          description: "Service dédié aux tests E2E",
          departmentId: testDepartment.id,
        },
      });
    }

    // Hash bcrypt pour "Test1234!"
    // $2b$12$p8.aVWgMEMoZgDGqOFxDgeMC2pxFJR8MGvZEijZexY9AcO9fxRs6.
    const testPasswordHash =
      "$2b$12$p8.aVWgMEMoZgDGqOFxDgeMC2pxFJR8MGvZEijZexY9AcO9fxRs6.";

    // 6 utilisateurs de test (un par rôle)
    const adminTest = await prisma.user.upsert({
      where: { email: "admin-test@orchestr-a.test" },
      update: {},
      create: {
        email: "admin-test@orchestr-a.test",
        login: "admin-test",
        passwordHash: testPasswordHash,
        firstName: "Admin",
        lastName: "Test",
        roleId: requireRoleId("ADMIN"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const responsableTest = await prisma.user.upsert({
      where: { email: "responsable-test@orchestr-a.test" },
      update: {},
      create: {
        email: "responsable-test@orchestr-a.test",
        login: "responsable-test",
        passwordHash: testPasswordHash,
        firstName: "Responsable",
        lastName: "Test",
        roleId: requireRoleId("RESPONSABLE"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const managerTest = await prisma.user.upsert({
      where: { email: "manager-test@orchestr-a.test" },
      update: {},
      create: {
        email: "manager-test@orchestr-a.test",
        login: "manager-test",
        passwordHash: testPasswordHash,
        firstName: "Manager",
        lastName: "Test",
        roleId: requireRoleId("MANAGER"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const referentTest = await prisma.user.upsert({
      where: { email: "referent-test@orchestr-a.test" },
      update: {},
      create: {
        email: "referent-test@orchestr-a.test",
        login: "referent-test",
        passwordHash: testPasswordHash,
        firstName: "Referent",
        lastName: "Test",
        roleId: requireRoleId("REFERENT_TECHNIQUE"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const contributeurTest = await prisma.user.upsert({
      where: { email: "contributeur-test@orchestr-a.test" },
      update: {},
      create: {
        email: "contributeur-test@orchestr-a.test",
        login: "contributeur-test",
        passwordHash: testPasswordHash,
        firstName: "Contributeur",
        lastName: "Test",
        roleId: requireRoleId("CONTRIBUTEUR"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const observateurTest = await prisma.user.upsert({
      where: { email: "observateur-test@orchestr-a.test" },
      update: {},
      create: {
        email: "observateur-test@orchestr-a.test",
        login: "observateur-test",
        passwordHash: testPasswordHash,
        firstName: "Observateur",
        lastName: "Test",
        roleId: requireRoleId("OBSERVATEUR"),
        departmentId: testDepartment.id,
        isActive: true,
      },
    });

    const testUsers = [
      adminTest,
      responsableTest,
      managerTest,
      referentTest,
      contributeurTest,
      observateurTest,
    ];

    // RESPONSABLE = manager du département, MANAGER = manager du service
    await prisma.department.update({
      where: { id: testDepartment.id },
      data: { managerId: responsableTest.id },
    });
    await prisma.service.update({
      where: { id: testService.id },
      data: { managerId: managerTest.id },
    });

    // Rattacher tous au service de test
    await Promise.all(
      testUsers.map((u) =>
        prisma.userService.upsert({
          where: {
            userId_serviceId: { userId: u.id, serviceId: testService!.id },
          },
          update: {},
          create: { userId: u.id, serviceId: testService!.id },
        }),
      ),
    );

    console.log("✅ E2E test users ready (6 roles)");

    // Projet E2E
    let e2eProject = await prisma.project.findFirst({
      where: { name: "Projet E2E" },
    });
    if (!e2eProject) {
      e2eProject = await prisma.project.create({
        data: {
          name: "Projet E2E",
          description: "Projet dédié aux tests E2E",
          status: "ACTIVE",
          priority: "NORMAL",
          startDate: new Date("2026-01-01"),
          createdById: adminTest.id,
        },
      });
    }

    // Ajouter tous les utilisateurs test comme membres du projet E2E
    await Promise.all(
      testUsers.map((u) =>
        prisma.projectMember.upsert({
          where: {
            projectId_userId: { projectId: e2eProject!.id, userId: u.id },
          },
          update: {},
          create: {
            projectId: e2eProject!.id,
            userId: u.id,
            role: "Membre",
          },
        }),
      ),
    );

    // 3 tâches de test
    const e2eTasks = [
      {
        title: "Tâche E2E 1 - TODO",
        status: "TODO" as const,
        assigneeId: contributeurTest.id,
      },
      {
        title: "Tâche E2E 2 - IN_PROGRESS",
        status: "IN_PROGRESS" as const,
        assigneeId: managerTest.id,
      },
      {
        title: "Tâche E2E 3 - DONE",
        status: "DONE" as const,
        assigneeId: referentTest.id,
      },
    ];
    for (const taskData of e2eTasks) {
      const existing = await prisma.task.findFirst({
        where: { title: taskData.title, projectId: e2eProject.id },
      });
      if (!existing) {
        await prisma.task.create({
          data: {
            title: taskData.title,
            status: taskData.status,
            priority: "NORMAL",
            projectId: e2eProject.id,
            assigneeId: taskData.assigneeId,
          },
        });
      }
    }

    console.log("✅ E2E project + 3 tasks ready");

    // LeaveTypeConfig CP (nécessaire pour créer un congé)
    const cpLeaveType = await prisma.leaveTypeConfig.upsert({
      where: { code: "CP_E2E" },
      update: {},
      create: {
        code: "CP_E2E",
        name: "Congés payés (E2E)",
        icon: "🏖️",
        color: "#3B82F6",
        isPaid: true,
        requiresApproval: true,
        isActive: true,
        isSystem: false,
      },
    });

    // 1 congé PENDING pour contributeurTest
    const leaveStart = new Date("2026-04-01");
    const leaveEnd = new Date("2026-04-03");
    const existingLeave = await prisma.leave.findFirst({
      where: { userId: contributeurTest.id, leaveTypeId: cpLeaveType.id },
    });
    if (!existingLeave) {
      await prisma.leave.create({
        data: {
          userId: contributeurTest.id,
          leaveTypeId: cpLeaveType.id,
          startDate: leaveStart,
          endDate: leaveEnd,
          days: 3,
          status: "PENDING",
          validatorId: managerTest.id,
        },
      });
    }

    console.log("✅ E2E leave (PENDING) ready");

    // 1 télétravail pour contributeurTest
    const teleworkDate = new Date("2026-04-07");
    await prisma.teleworkSchedule.upsert({
      where: {
        userId_date: { userId: contributeurTest.id, date: teleworkDate },
      },
      update: {},
      create: {
        userId: contributeurTest.id,
        date: teleworkDate,
        isTelework: true,
      },
    });

    console.log("✅ E2E telework entry ready");
    console.log(
      "🧪 E2E seed complete — 6 users, 1 project, 3 tasks, 1 leave, 1 telework",
    );
  }

  console.log("🎉 Seeding complete!");
}

// Only run main() when this file is the direct entry point (ts-node prisma/seed.ts),
// not when imported by seed-permissions.ts or other entry points.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Error seeding database:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
