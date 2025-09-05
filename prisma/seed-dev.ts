import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development database with test data...');

  // Clear existing data in development
  await prisma.report.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.smoke.deleteMany();
  await prisma.user.deleteMany();
  await prisma.map.deleteMany();

  // Seed maps
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
  ];

  const createdMaps = [];
  for (const map of maps) {
    const createdMap = await prisma.map.create({
      data: map,
    });
    createdMaps.push(createdMap);
    console.log(`Created map: ${createdMap.name}`);
  }

  // Seed test users
  const users = [
    {
      steamId: '76561198000000001',
      username: 'TestPlayer1',
      avatarUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
    },
    {
      steamId: '76561198000000002',
      username: 'SmokeExpert',
      avatarUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
    },
    {
      steamId: '76561198000000003',
      username: 'CS2Pro',
      avatarUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
    },
  ];

  const createdUsers = [];
  for (const user of users) {
    const createdUser = await prisma.user.create({
      data: user,
    });
    createdUsers.push(createdUser);
    console.log(`Created user: ${createdUser.username}`);
  }

  // Seed test smokes
  const smokes = [
    {
      title: 'Xbox Smoke from Long',
      videoUrl: 'https://www.youtube.com/watch?v=example1',
      timestamp: 15,
      x_coord: 1024.5,
      y_coord: 768.2,
      authorId: createdUsers[0].id,
      mapId: createdMaps[0].id, // Dust2
    },
    {
      title: 'CT Smoke from Tunnels',
      videoUrl: 'https://www.youtube.com/watch?v=example2',
      timestamp: 22,
      x_coord: 512.8,
      y_coord: 1024.1,
      authorId: createdUsers[1].id,
      mapId: createdMaps[0].id, // Dust2
    },
    {
      title: 'Connector Smoke from Palace',
      videoUrl: 'https://www.youtube.com/watch?v=example3',
      timestamp: 18,
      x_coord: 800.3,
      y_coord: 600.7,
      authorId: createdUsers[0].id,
      mapId: createdMaps[1].id, // Mirage
    },
    {
      title: 'Jungle Smoke from Ramp',
      videoUrl: 'https://www.youtube.com/watch?v=example4',
      timestamp: 25,
      x_coord: 900.1,
      y_coord: 450.9,
      authorId: createdUsers[2].id,
      mapId: createdMaps[1].id, // Mirage
    },
    {
      title: 'Balcony Smoke from Apartments',
      videoUrl: 'https://www.youtube.com/watch?v=example5',
      timestamp: 20,
      x_coord: 700.5,
      y_coord: 800.3,
      authorId: createdUsers[1].id,
      mapId: createdMaps[2].id, // Inferno
    },
  ];

  const createdSmokes = [];
  for (const smoke of smokes) {
    const createdSmoke = await prisma.smoke.create({
      data: smoke,
    });
    createdSmokes.push(createdSmoke);
    console.log(`Created smoke: ${createdSmoke.title}`);
  }

  // Seed test ratings
  const ratings = [
    { userId: createdUsers[1].id, smokeId: createdSmokes[0].id, value: 1 },
    { userId: createdUsers[2].id, smokeId: createdSmokes[0].id, value: 1 },
    { userId: createdUsers[0].id, smokeId: createdSmokes[1].id, value: -1 },
    { userId: createdUsers[2].id, smokeId: createdSmokes[1].id, value: 1 },
    { userId: createdUsers[1].id, smokeId: createdSmokes[2].id, value: 1 },
    { userId: createdUsers[2].id, smokeId: createdSmokes[3].id, value: 1 },
    { userId: createdUsers[0].id, smokeId: createdSmokes[4].id, value: 1 },
  ];

  for (const rating of ratings) {
    await prisma.rating.create({
      data: rating,
    });
  }
  console.log(`Created ${ratings.length} test ratings`);

  // Seed test reports
  const reports = [
    {
      reason: 'This smoke strategy is outdated and no longer works in the current version of CS2.',
      reporterId: createdUsers[2].id,
      smokeId: createdSmokes[1].id,
    },
    {
      reason: 'The video contains inappropriate content that violates community guidelines.',
      reporterId: createdUsers[0].id,
      smokeId: createdSmokes[3].id,
    },
  ];

  for (const report of reports) {
    await prisma.report.create({
      data: report,
    });
  }
  console.log(`Created ${reports.length} test reports`);

  console.log('Development database seeded successfully with test data!');
  console.log(`- ${createdMaps.length} maps`);
  console.log(`- ${createdUsers.length} users`);
  console.log(`- ${createdSmokes.length} smokes`);
  console.log(`- ${ratings.length} ratings`);
  console.log(`- ${reports.length} reports`);
}

main()
  .catch((e) => {
    console.error('Error seeding development database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });