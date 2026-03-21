import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create or get admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@orchestr-a.internal" },
    update: {},
    create: {
      email: "admin@orchestr-a.internal",
      login: "admin",
      passwordHash:
        "$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG", // password: admin123
      firstName: "Admin",
      lastName: "System",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✅ Admin user ready:", admin.email);

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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
        role: "CONTRIBUTEUR",
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
  // RBAC — Permissions et rôles système (idempotent via upsert)
  // ============================================================

  const permissionsData = [
    // Projects
    { code: "projects:create", module: "projects", action: "create", description: "Créer un projet" },
    { code: "projects:read", module: "projects", action: "read", description: "Voir les projets" },
    { code: "projects:update", module: "projects", action: "update", description: "Modifier un projet" },
    { code: "projects:delete", module: "projects", action: "delete", description: "Supprimer un projet" },
    { code: "projects:manage_members", module: "projects", action: "manage_members", description: "Gérer les membres d'un projet" },
    { code: "projects:view", module: "projects", action: "view", description: "Voir les projets (granularité RBAC)" },
    { code: "projects:edit", module: "projects", action: "edit", description: "Modifier les projets (granularité RBAC)" },
    // Tasks
    { code: "tasks:create", module: "tasks", action: "create", description: "Créer une tâche dans un projet" },
    { code: "tasks:read", module: "tasks", action: "read", description: "Voir les tâches" },
    { code: "tasks:update", module: "tasks", action: "update", description: "Modifier une tâche" },
    { code: "tasks:delete", module: "tasks", action: "delete", description: "Supprimer une tâche" },
    { code: "tasks:create_in_project", module: "tasks", action: "create_in_project", description: "Créer des tâches dans les projets dont on est membre" },
    { code: "tasks:create_orphan", module: "tasks", action: "create_orphan", description: "Créer des tâches orphelines (sans projet)" },
    // Events
    { code: "events:create", module: "events", action: "create", description: "Créer un événement" },
    { code: "events:read", module: "events", action: "read", description: "Voir les événements" },
    { code: "events:update", module: "events", action: "update", description: "Modifier un événement" },
    { code: "events:delete", module: "events", action: "delete", description: "Supprimer un événement" },
    // Epics
    { code: "epics:create", module: "epics", action: "create", description: "Créer un epic" },
    { code: "epics:read", module: "epics", action: "read", description: "Voir les epics" },
    { code: "epics:update", module: "epics", action: "update", description: "Modifier un epic" },
    { code: "epics:delete", module: "epics", action: "delete", description: "Supprimer un epic" },
    // Milestones
    { code: "milestones:create", module: "milestones", action: "create", description: "Créer un jalon" },
    { code: "milestones:read", module: "milestones", action: "read", description: "Voir les jalons" },
    { code: "milestones:update", module: "milestones", action: "update", description: "Modifier un jalon" },
    { code: "milestones:delete", module: "milestones", action: "delete", description: "Supprimer un jalon" },
    // Leaves
    { code: "leaves:create", module: "leaves", action: "create", description: "Poser une demande de congé" },
    { code: "leaves:read", module: "leaves", action: "read", description: "Voir les congés" },
    { code: "leaves:update", module: "leaves", action: "update", description: "Modifier une demande de congé" },
    { code: "leaves:delete", module: "leaves", action: "delete", description: "Supprimer une demande de congé" },
    { code: "leaves:approve", module: "leaves", action: "approve", description: "Valider ou rejeter des congés" },
    { code: "leaves:manage_delegations", module: "leaves", action: "manage_delegations", description: "Gérer les délégations de validation" },
    { code: "leaves:view", module: "leaves", action: "view", description: "Voir les congés (granularité RBAC)" },
    { code: "leaves:manage", module: "leaves", action: "manage", description: "Valider ou rejeter des demandes de congés" },
    { code: "leaves:declare_for_others", module: "leaves", action: "declare_for_others", description: "Déclarer des congés au nom d'un autre agent" },
    // Telework
    { code: "telework:create", module: "telework", action: "create", description: "Déclarer du télétravail" },
    { code: "telework:read", module: "telework", action: "read", description: "Voir le télétravail" },
    { code: "telework:update", module: "telework", action: "update", description: "Modifier une déclaration de télétravail" },
    { code: "telework:delete", module: "telework", action: "delete", description: "Supprimer une déclaration de télétravail" },
    { code: "telework:read_team", module: "telework", action: "read_team", description: "Voir le télétravail de l'équipe" },
    { code: "telework:manage_others", module: "telework", action: "manage_others", description: "Gérer le télétravail des autres agents" },
    { code: "telework:view", module: "telework", action: "view", description: "Voir le télétravail (granularité RBAC)" },
    // Skills
    { code: "skills:create", module: "skills", action: "create", description: "Ajouter une compétence" },
    { code: "skills:read", module: "skills", action: "read", description: "Voir les compétences" },
    { code: "skills:update", module: "skills", action: "update", description: "Modifier une compétence" },
    { code: "skills:delete", module: "skills", action: "delete", description: "Supprimer une compétence" },
    { code: "skills:manage_matrix", module: "skills", action: "manage_matrix", description: "Gérer la matrice de compétences" },
    { code: "skills:view", module: "skills", action: "view", description: "Voir les compétences (granularité RBAC)" },
    { code: "skills:edit", module: "skills", action: "edit", description: "Modifier les compétences (granularité RBAC)" },
    // Time Tracking
    { code: "time_tracking:create", module: "time_tracking", action: "create", description: "Saisir du temps" },
    { code: "time_tracking:read", module: "time_tracking", action: "read", description: "Voir les saisies de temps" },
    { code: "time_tracking:update", module: "time_tracking", action: "update", description: "Modifier une saisie de temps" },
    { code: "time_tracking:delete", module: "time_tracking", action: "delete", description: "Supprimer une saisie de temps" },
    { code: "time_tracking:read_reports", module: "time_tracking", action: "read_reports", description: "Voir les rapports de temps" },
    // Users
    { code: "users:create", module: "users", action: "create", description: "Créer un utilisateur" },
    { code: "users:read", module: "users", action: "read", description: "Voir les utilisateurs" },
    { code: "users:update", module: "users", action: "update", description: "Modifier un utilisateur" },
    { code: "users:delete", module: "users", action: "delete", description: "Supprimer un utilisateur" },
    { code: "users:import", module: "users", action: "import", description: "Importer des utilisateurs" },
    { code: "users:manage_roles", module: "users", action: "manage_roles", description: "Gérer les rôles des utilisateurs" },
    { code: "users:view", module: "users", action: "view", description: "Voir les utilisateurs (granularité RBAC)" },
    { code: "users:edit", module: "users", action: "edit", description: "Modifier les utilisateurs (granularité RBAC)" },
    // Departments
    { code: "departments:create", module: "departments", action: "create", description: "Créer un département/service" },
    { code: "departments:read", module: "departments", action: "read", description: "Voir les départements/services" },
    { code: "departments:update", module: "departments", action: "update", description: "Modifier un département/service" },
    { code: "departments:delete", module: "departments", action: "delete", description: "Supprimer un département/service" },
    { code: "departments:view", module: "departments", action: "view", description: "Voir les départements (granularité RBAC)" },
    { code: "departments:edit", module: "departments", action: "edit", description: "Modifier les départements (granularité RBAC)" },
    // Services
    { code: "services:create", module: "services", action: "create", description: "Créer un service" },
    { code: "services:read", module: "services", action: "read", description: "Voir les services" },
    { code: "services:update", module: "services", action: "update", description: "Modifier un service" },
    { code: "services:delete", module: "services", action: "delete", description: "Supprimer un service" },
    // Documents
    { code: "documents:create", module: "documents", action: "create", description: "Uploader un document" },
    { code: "documents:read", module: "documents", action: "read", description: "Voir les documents" },
    { code: "documents:update", module: "documents", action: "update", description: "Modifier un document" },
    { code: "documents:delete", module: "documents", action: "delete", description: "Supprimer un document" },
    // Comments
    { code: "comments:create", module: "comments", action: "create", description: "Écrire un commentaire" },
    { code: "comments:read", module: "comments", action: "read", description: "Voir les commentaires" },
    { code: "comments:update", module: "comments", action: "update", description: "Modifier un commentaire" },
    { code: "comments:delete", module: "comments", action: "delete", description: "Supprimer un commentaire" },
    // Settings
    { code: "settings:read", module: "settings", action: "read", description: "Voir les paramètres" },
    { code: "settings:update", module: "settings", action: "update", description: "Modifier les paramètres" },
    // Analytics
    { code: "analytics:read", module: "analytics", action: "read", description: "Voir les analytics" },
    { code: "analytics:export", module: "analytics", action: "export", description: "Exporter les analytics" },
    // Reports (granularité distincte de analytics)
    { code: "reports:view", module: "reports", action: "view", description: "Voir les rapports" },
    { code: "reports:export", module: "reports", action: "export", description: "Exporter les rapports" },
    // Holidays
    { code: "holidays:create", module: "holidays", action: "create", description: "Créer un jour férié" },
    { code: "holidays:read", module: "holidays", action: "read", description: "Voir les jours fériés" },
    { code: "holidays:update", module: "holidays", action: "update", description: "Modifier un jour férié" },
    { code: "holidays:delete", module: "holidays", action: "delete", description: "Supprimer un jour férié" },
    // Predefined Tasks
    { code: "predefined_tasks:view", module: "predefined_tasks", action: "view", description: "Voir les tâches prédéfinies" },
    { code: "predefined_tasks:create", module: "predefined_tasks", action: "create", description: "Créer une tâche prédéfinie" },
    { code: "predefined_tasks:edit", module: "predefined_tasks", action: "edit", description: "Modifier une tâche prédéfinie" },
    { code: "predefined_tasks:delete", module: "predefined_tasks", action: "delete", description: "Supprimer une tâche prédéfinie" },
    { code: "predefined_tasks:assign", module: "predefined_tasks", action: "assign", description: "Assigner une tâche prédéfinie à un agent" },
    // Telework recurring
    { code: "telework:manage_recurring", module: "telework", action: "manage_recurring", description: "Gérer les règles de télétravail récurrentes" },
    // Users password reset
    { code: "users:reset_password", module: "users", action: "reset_password", description: "Réinitialiser le mot de passe d'un utilisateur" },
  ];

  // Upsert toutes les permissions
  const permissionsMap = new Map<string, string>();
  for (const perm of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
    permissionsMap.set(perm.code, permission.id);
  }

  console.log(`✅ ${permissionsData.length} permissions upserted`);

  // Rôles système — upsert (ne pas écraser les permissions existantes des rôles déjà en prod)
  const allPermCodes = permissionsData.map((p) => p.code);
  const rolesConfig = [
    {
      code: "ADMIN",
      name: "Administrateur",
      description: "Accès complet à toutes les fonctionnalités",
      isSystem: true,
      isDefault: false,
      permissions: allPermCodes, // Toutes les permissions
    },
    {
      code: "RESPONSABLE",
      name: "Responsable",
      description: "Gestion complète sauf rôles et settings",
      isSystem: true,
      isDefault: false,
      permissions: allPermCodes.filter(
        (c) => c !== "users:manage_roles" && c !== "settings:update",
      ),
    },
    {
      code: "MANAGER",
      name: "Manager",
      description: "Gestion de projets, tâches, congés équipe",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "time_tracking:read_reports",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "leaves:read", "leaves:view", "leaves:approve", "leaves:manage", "leaves:manage_delegations",
        "leaves:declare_for_others",
        "telework:read", "telework:view", "telework:manage_others", "telework:read_team",
        "telework:manage_recurring",
        "reports:view", "reports:export",
        "users:read", "users:view",
        "departments:read", "departments:view",
        "skills:read", "skills:view",
        "predefined_tasks:view", "predefined_tasks:create", "predefined_tasks:edit",
        "predefined_tasks:delete", "predefined_tasks:assign",
      ],
    },
    {
      code: "CHEF_DE_PROJET",
      name: "Chef de Projet",
      description: "Gestion de projets et tâches",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "telework:manage_others",
        "reports:view",
      ],
    },
    {
      code: "REFERENT_TECHNIQUE",
      name: "Référent Technique",
      description: "Création et modification de tâches dans les projets",
      isSystem: true,
      isDefault: false,
      permissions: [
        "tasks:create_in_project", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update", "events:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "skills:create", "skills:read", "skills:update", "skills:delete",
        "skills:manage_matrix", "skills:view", "skills:edit",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "CONTRIBUTEUR",
      name: "Contributeur",
      description: "Création de tâches orphelines et gestion personnelle",
      isSystem: true,
      isDefault: true,
      permissions: [
        "tasks:create_orphan", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update",
        "time_tracking:create", "time_tracking:read",
        "leaves:create", "leaves:read", "leaves:view",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "OBSERVATEUR",
      name: "Observateur",
      description: "Accès en lecture seule",
      isSystem: true,
      isDefault: false,
      permissions: permissionsData
        .filter((p) => p.action === "read" || p.action === "view")
        .map((p) => p.code),
    },
    {
      code: "TECHNICIEN_SUPPORT",
      name: "Technicien Support",
      description: "Support technique",
      isSystem: true,
      isDefault: false,
      permissions: [
        "tasks:create_orphan", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update",
        "time_tracking:create", "time_tracking:read",
        "leaves:create", "leaves:read", "leaves:view",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "GESTIONNAIRE_PARC",
      name: "Gestionnaire de Parc",
      description: "Gestion du parc informatique",
      isSystem: true,
      isDefault: false,
      permissions: [
        "tasks:create_orphan", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update",
        "time_tracking:create", "time_tracking:read",
        "leaves:create", "leaves:read", "leaves:view",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "ADMINISTRATEUR_IML",
      name: "Administrateur IML",
      description: "Administration IML",
      isSystem: true,
      isDefault: false,
      permissions: [
        "tasks:create_orphan", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update",
        "time_tracking:create", "time_tracking:read",
        "leaves:create", "leaves:read", "leaves:view",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "DEVELOPPEUR_CONCEPTEUR",
      name: "Développeur Concepteur",
      description: "Développement et conception",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "telework:create", "telework:read", "telework:update", "telework:delete",
        "telework:view", "telework:manage_others",
      ],
    },
    {
      code: "CORRESPONDANT_FONCTIONNEL_APPLICATION",
      name: "Correspondant Fonctionnel Application",
      description: "Référent fonctionnel applicatif",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "telework:create", "telework:read", "telework:update", "telework:delete",
        "telework:view", "telework:manage_others",
      ],
    },
    {
      code: "CHARGE_DE_MISSION",
      name: "Chargé de Mission",
      description: "Pilotage de missions",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "telework:create", "telework:read", "telework:update", "telework:delete",
        "telework:view", "telework:manage_others",
      ],
    },
    {
      code: "GESTIONNAIRE_IML",
      name: "Gestionnaire IML",
      description: "Gestion IML",
      isSystem: true,
      isDefault: false,
      permissions: [
        "tasks:create_orphan", "tasks:read", "tasks:update",
        "events:create", "events:read", "events:update",
        "time_tracking:create", "time_tracking:read",
        "leaves:create", "leaves:read", "leaves:view",
        "telework:create", "telework:read", "telework:update", "telework:delete", "telework:view",
      ],
    },
    {
      code: "CONSULTANT_TECHNOLOGIE_SI",
      name: "Consultant Technologie SI",
      description: "Conseil en technologies SI",
      isSystem: true,
      isDefault: false,
      permissions: [
        "projects:create", "projects:read", "projects:update", "projects:delete",
        "projects:manage_members", "projects:view", "projects:edit",
        "tasks:create", "tasks:read", "tasks:update", "tasks:delete", "tasks:create_in_project",
        "events:create", "events:read", "events:update", "events:delete",
        "epics:create", "epics:read", "epics:update", "epics:delete",
        "milestones:create", "milestones:read", "milestones:update", "milestones:delete",
        "time_tracking:create", "time_tracking:read", "time_tracking:update", "time_tracking:delete",
        "documents:create", "documents:read", "documents:update", "documents:delete",
        "comments:create", "comments:read", "comments:update", "comments:delete",
        "telework:create", "telework:read", "telework:update", "telework:delete",
        "telework:view", "telework:manage_others",
      ],
    },
  ];

  let rolesCreated = 0;
  let rolesSkipped = 0;

  for (const roleData of rolesConfig) {
    const { permissions, ...roleInfo } = roleData;

    // Vérifier si le rôle existe déjà (pour ne pas écraser les permissions en prod)
    const existingRole = await prisma.roleConfig.findUnique({
      where: { code: roleData.code },
      include: { permissions: true },
    });

    const role = await prisma.roleConfig.upsert({
      where: { code: roleData.code },
      update: {
        name: roleInfo.name,
        description: roleInfo.description,
        isSystem: roleInfo.isSystem,
      },
      create: roleInfo,
    });

    // Si le rôle existait déjà ET avait des permissions → préserver (ne pas écraser)
    if (existingRole && existingRole.permissions.length > 0) {
      // Ajouter uniquement les nouvelles permissions manquantes (sans supprimer les existantes)
      const existingPermIds = new Set(existingRole.permissions.map((rp) => rp.permissionId));
      const toAdd = permissions
        .map((permCode) => permissionsMap.get(permCode))
        .filter((permId): permId is string => !!permId && !existingPermIds.has(permId))
        .map((permId) => ({ roleConfigId: role.id, permissionId: permId }));

      if (toAdd.length > 0) {
        await prisma.rolePermission.createMany({ data: toAdd, skipDuplicates: true });
        console.log(`  → ${roleData.code}: ${toAdd.length} nouvelles permissions ajoutées`);
      }
      rolesSkipped++;
      continue;
    }

    // Nouveau rôle : créer toutes les permissions par défaut
    const permissionAssignments = permissions
      .map((permCode) => permissionsMap.get(permCode))
      .filter((permId): permId is string => !!permId)
      .map((permId) => ({ roleConfigId: role.id, permissionId: permId }));

    if (permissionAssignments.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionAssignments,
        skipDuplicates: true,
      });
    }
    rolesCreated++;
  }

  console.log(
    `✅ RBAC: ${rolesCreated} rôles créés avec permissions par défaut, ${rolesSkipped} rôles existants mis à jour (nouvelles permissions uniquement)`,
  );

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
