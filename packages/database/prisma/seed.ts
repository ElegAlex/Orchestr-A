import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create or get admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@orchestr-a.internal' },
    update: {},
    create: {
      email: 'admin@orchestr-a.internal',
      login: 'admin',
      passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG', // password: admin123
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin user ready:', admin.email);

  // Create or get department
  let department = await prisma.department.findFirst({
    where: { name: 'Direction des Systèmes d\'Information' },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        name: 'Direction des Systèmes d\'Information',
        description: 'Département DSI',
      },
    });
  }

  console.log('✅ Department ready:', department.name);

  // Create or get services
  let serviceHelpdesk = await prisma.service.findFirst({
    where: { name: 'Service Helpdesk' },
  });

  if (!serviceHelpdesk) {
    serviceHelpdesk = await prisma.service.create({
      data: {
        name: 'Service Helpdesk',
        description: 'Support utilisateur et assistance technique',
        departmentId: department.id,
      },
    });
  }

  let serviceAdminSys = await prisma.service.findFirst({
    where: { name: 'Service Administration Système' },
  });

  if (!serviceAdminSys) {
    serviceAdminSys = await prisma.service.create({
      data: {
        name: 'Service Administration Système',
        description: 'Gestion des infrastructures et systèmes',
        departmentId: department.id,
      },
    });
  }

  let serviceDev = await prisma.service.findFirst({
    where: { name: 'Service Développement' },
  });

  if (!serviceDev) {
    serviceDev = await prisma.service.create({
      data: {
        name: 'Service Développement',
        description: 'Développement d\'applications et logiciels',
        departmentId: department.id,
      },
    });
  }

  console.log('✅ Services ready:', serviceHelpdesk.name, serviceAdminSys.name, serviceDev.name);

  // Create or get Helpdesk employees
  const helpdeskEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: 'sophie.martin@orchestr-a.internal' },
      update: {},
      create: {
        email: 'sophie.martin@orchestr-a.internal',
        login: 'smartin',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Sophie',
        lastName: 'Martin',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'thomas.bernard@orchestr-a.internal' },
      update: {},
      create: {
        email: 'thomas.bernard@orchestr-a.internal',
        login: 'tbernard',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Thomas',
        lastName: 'Bernard',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'julie.dubois@orchestr-a.internal' },
      update: {},
      create: {
        email: 'julie.dubois@orchestr-a.internal',
        login: 'jdubois',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Julie',
        lastName: 'Dubois',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'nicolas.rousseau@orchestr-a.internal' },
      update: {},
      create: {
        email: 'nicolas.rousseau@orchestr-a.internal',
        login: 'nrousseau',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Nicolas',
        lastName: 'Rousseau',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'marie.lefevre@orchestr-a.internal' },
      update: {},
      create: {
        email: 'marie.lefevre@orchestr-a.internal',
        login: 'mlefevre',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Marie',
        lastName: 'Lefevre',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Helpdesk employees to service
  await Promise.all(
    helpdeskEmployees.map(emp =>
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
      })
    )
  );

  console.log('✅ 5 Helpdesk employees ready');

  // Create or get Admin Sys employees
  const adminSysEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: 'pierre.moreau@orchestr-a.internal' },
      update: {},
      create: {
        email: 'pierre.moreau@orchestr-a.internal',
        login: 'pmoreau',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Pierre',
        lastName: 'Moreau',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'isabelle.simon@orchestr-a.internal' },
      update: {},
      create: {
        email: 'isabelle.simon@orchestr-a.internal',
        login: 'isimon',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Isabelle',
        lastName: 'Simon',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'laurent.michel@orchestr-a.internal' },
      update: {},
      create: {
        email: 'laurent.michel@orchestr-a.internal',
        login: 'lmichel',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Laurent',
        lastName: 'Michel',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'celine.garcia@orchestr-a.internal' },
      update: {},
      create: {
        email: 'celine.garcia@orchestr-a.internal',
        login: 'cgarcia',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Céline',
        lastName: 'Garcia',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'alexandre.roux@orchestr-a.internal' },
      update: {},
      create: {
        email: 'alexandre.roux@orchestr-a.internal',
        login: 'aroux',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Alexandre',
        lastName: 'Roux',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Admin Sys employees to service
  await Promise.all(
    adminSysEmployees.map(emp =>
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
      })
    )
  );

  console.log('✅ 5 Admin Sys employees ready');

  // Create or get Developer employees
  const devEmployees = await Promise.all([
    prisma.user.upsert({
      where: { email: 'emma.petit@orchestr-a.internal' },
      update: {},
      create: {
        email: 'emma.petit@orchestr-a.internal',
        login: 'epetit',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Emma',
        lastName: 'Petit',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'maxime.durand@orchestr-a.internal' },
      update: {},
      create: {
        email: 'maxime.durand@orchestr-a.internal',
        login: 'mdurand',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Maxime',
        lastName: 'Durand',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'camille.laurent@orchestr-a.internal' },
      update: {},
      create: {
        email: 'camille.laurent@orchestr-a.internal',
        login: 'claurent',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Camille',
        lastName: 'Laurent',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'hugo.girard@orchestr-a.internal' },
      update: {},
      create: {
        email: 'hugo.girard@orchestr-a.internal',
        login: 'hgirard',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Hugo',
        lastName: 'Girard',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'lea.fontaine@orchestr-a.internal' },
      update: {},
      create: {
        email: 'lea.fontaine@orchestr-a.internal',
        login: 'lfontaine',
        passwordHash: '$2b$12$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
        firstName: 'Léa',
        lastName: 'Fontaine',
        role: 'CONTRIBUTEUR',
        departmentId: department.id,
        isActive: true,
      },
    }),
  ]);

  // Link Developer employees to service
  await Promise.all(
    devEmployees.map(emp =>
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
      })
    )
  );

  console.log('✅ 5 Developer employees ready');

  // Create a test project
  const project = await prisma.project.create({
    data: {
      name: 'Projet de test',
      description: 'Premier projet de test',
      status: 'ACTIVE',
      priority: 'NORMAL',
      startDate: new Date(),
      budgetHours: 100,
    },
  });

  console.log('✅ Project created:', project.name);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
