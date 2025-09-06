import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const maps = [
    {
      name: 'Dust2',
      thumbnail: 'https://static.wikia.nocookie.net/cswikia/images/1/16/Cs2_dust2.png',
      radar: '/images/maps/map_dust2.webp'
    },
    {
      name: 'Mirage',
      thumbnail: 'https://static.wikia.nocookie.net/cswikia/images/f/f5/De_mirage_cs2.png',
      radar: '/images/maps/map_mirage.webp'
    },
    {
      name: 'Inferno',
      thumbnail: 'https://static.wikia.nocookie.net/cswikia/images/1/17/Cs2_inferno_remake.png',
      radar: '/images/maps/map_inferno.webp'
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