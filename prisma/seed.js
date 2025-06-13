const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');
  
  // Create sample users
  const clientPassword = await bcrypt.hash('client123', 12);
  const providerPassword = await bcrypt.hash('provider123', 12);
  
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      name: 'Jonas Klientas',
      password: clientPassword,
      role: 'CLIENT'
    }
  });
  
  const provider = await prisma.user.upsert({
    where: { email: 'provider@example.com' },
    update: {},
    create: {
      email: 'provider@example.com',
      name: 'Petras Teikėjas',
      password: providerPassword,
      role: 'PROVIDER'
    }
  });
  
  // Create sample projects with different auction phases for testing
  const now = new Date();
  
  // Project 1: WAITING phase (auction starts in 2 minutes for testing)
  const project1 = await prisma.project.upsert({
    where: { id: 'sample-project-1' },
    update: {},
    create: {
      id: 'sample-project-1',
      title: 'Vonios kambario plyteliu klojimas',
      description: 'Reikalingas profesionalus plytelių klojimas vonios kambaryje. Plotas apie 15kv.m. Norime kokybiško darbo ir garantijos.',
      category: 'tile_laying',
      budgetRange: '800-1500 EUR',
      budgetMin: 800,
      budgetMax: 1500,
      deadline: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      location: 'Vilnius',
      city: 'Vilnius',
      priority: 'EXPERIENCE',
      phase: 'WAITING',
      status: 'WAITING',
      waitingStartsAt: now,
      auctionStartsAt: new Date(now.getTime() + 2 * 60 * 1000), // 2 minutes
      auctionEndsAt: new Date(now.getTime() + 2 * 60 * 1000 + 5 * 60 * 1000), // 5 minutes after auction starts
      clientId: client.id
    }
  });
  
  // Project 2: ACTIVE phase (auction started, ends in 3 minutes)
  const project2 = await prisma.project.upsert({
    where: { id: 'sample-project-2' },
    update: {},
    create: {
      id: 'sample-project-2',
      title: 'Elektros instaliacijos darbai name',
      description: 'Reikalingas licencijuotas elektrikas papildomų rozečių įrengimui ir elektrinio skydo atnaujinimui private name.',
      category: 'electrical_work',
      budgetRange: '500-1200 EUR',
      budgetMin: 500,
      budgetMax: 1200,
      deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      location: 'Kaunas',
      city: 'Kaunas',
      priority: 'SPEED',
      phase: 'ACTIVE',
      status: 'ACTIVE',
      waitingStartsAt: new Date(now.getTime() - 72 * 60 * 60 * 1000), // Started 72h ago
      auctionStartsAt: new Date(now.getTime() - 30 * 60 * 1000), // Started 30 min ago
      auctionEndsAt: new Date(now.getTime() + 3 * 60 * 1000), // Ends in 3 minutes
      clientId: client.id
    }
  });
  
  // Project 3: ENDED phase (auction ended, awaiting selection)
  const project3 = await prisma.project.upsert({
    where: { id: 'sample-project-3' },
    update: {},
    create: {
      id: 'sample-project-3',
      title: 'Stogo dengimas',
      description: 'Senojo stogo keitimas į naują metalocementini stogą. Namo plotas 120kv.m. Reikalingas patikimas rangovas su garantija.',
      category: 'roofing',
      budgetRange: '3000-5000 EUR',
      budgetMin: 3000,
      budgetMax: 5000,
      deadline: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
      location: 'Klaipėda',
      city: 'Klaipėda',
      priority: 'PRICE',
      phase: 'ENDED',
      status: 'ACTIVE',
      waitingStartsAt: new Date(now.getTime() - 96 * 60 * 60 * 1000), // Started 96h ago
      auctionStartsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Started 24h ago
      auctionEndsAt: new Date(now.getTime() - 30 * 60 * 1000), // Ended 30 min ago
      clientId: client.id
    }
  });
  
  // Create sample proposals
  await prisma.proposal.upsert({
    where: { id: 'sample-proposal-1' },
    update: {},
    create: {
      id: 'sample-proposal-1',
      price: 1200,
      duration: 5,
      comment: 'Turiu 8 metų patirtį plytelių klojime. Naudoju tik kokybiškas medžiagas ir teikiu 2 metų garantiją.',
      projectId: project1.id,
      providerId: provider.id
    }
  });
  
  await prisma.proposal.upsert({
    where: { id: 'sample-proposal-2' },
    update: {},
    create: {
      id: 'sample-proposal-2',
      price: 800,
      duration: 3,
      comment: 'Licencijuotas elektrikas su 12 metų patirtimi. Galiu atlikti darbus per savaitgalį.',
      projectId: project2.id,
      providerId: provider.id
    }
  });
  
  // Create portfolio items for provider
  await prisma.portfolioItem.create({
    data: {
      title: 'Moderni vonios plytelių klojimas',
      description: 'Aukštos kokybės plytelių klojimas su hidroizoliacija',
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800',
      category: 'tile_laying',
      completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      providerId: provider.id
    }
  });
  
  await prisma.portfolioItem.create({
    data: {
      title: 'Elektros instaliacijos name',
      description: 'Pilnas elektros skydo atnaujinimas su naujomis rozetėmis',
      imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800',
      category: 'electrical_work',
      completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      providerId: provider.id
    }
  });
  
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔑 Prisijungimo duomenys:');
  console.log('👨‍💼 Klientas: client@example.com / client123');
  console.log('👨‍💻 Teikėjas: provider@example.com / provider123');
  console.log('');
  console.log('🎯 Sukurti projektai:');
  console.log('- Vonios kambario plytelių klojimas (tile_laying)');
  console.log('- Elektros instaliacijos darbai (electrical_work)');
  console.log('- Stogo dengimas (roofing)');
  console.log('');
  console.log('💼 Portfolio elementai:');
  console.log('- Moderni vonios plytelių klojimas');
  console.log('- Elektros instaliacijos name');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

