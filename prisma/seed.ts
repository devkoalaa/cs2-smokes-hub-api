import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed maps with comprehensive CS2 map pool
  const maps = [
    {
      name: 'Dust2',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344413/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Mirage',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344414/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Inferno',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344415/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Cache',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344416/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Overpass',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344417/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Vertigo',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344418/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Ancient',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344419/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Anubis',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344420/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
    {
      name: 'Nuke',
      imageUrl: 'https://steamuserimages-a.akamaihd.net/ugc/1754695853838344421/B0C8E7F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5/',
    },
  ];

  for (const map of maps) {
    await prisma.map.upsert({
      where: { name: map.name },
      update: {},
      create: map,
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });