import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@orchestr-a.internal',
      login: 'admin',
      passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeKHfeOJe', // password: admin123
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create a department
  const department = await prisma.department.create({
    data: {
      name: 'Direction des Systèmes d\'Information',
      description: 'Département DSI',
    },
  });

  console.log('✅ Department created:', department.name);

  // Create a service
  const service = await prisma.service.create({
    data: {
      name: 'Service Développement',
      description: 'Équipe de développement',
      departmentId: department.id,
    },
  });

  console.log('✅ Service created:', service.name);

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
