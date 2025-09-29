import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const maps = [
    {
      name: "Dust2",
      radar: "/images/maps/map_dust2.webp",
      thumbnail: "https://i.imgur.com/jzz8b9m.png",
      description: "O mais clássico. Duas bombas, uma rota central. Perfeito para duelos rápidos e jogabilidade direta."
    },
    {
      name: "Mirage",
      radar: "/images/maps/map_mirage.webp",
      thumbnail: "https://i.imgur.com/dbxBoRP.png",
      description: "Icônico e equilibrado. Cenário de deserto com rotas claras, ideal para qualquer estilo de jogo."
    },
    {
      name: "Inferno",
      radar: "/images/maps/map_inferno.webp",
      "thumbnail": "https://i.imgur.com/hjkC5vU.png",
      description: "Vila italiana. Ruas estreitas e corredores que favorecem táticas com granadas e confrontos de perto."
    },
    {
      name: "Ancient",
      radar: "/images/maps/map_ancient.webp",
      thumbnail: "https://i.imgur.com/HfoZbYg.png",
      description: "Ruínas antigas. Terreno irregular e áreas de bomba separadas, exigindo controle tático e uso de utilitários."
    },
    {
      name: "Nuke",
      radar: "/images/maps/map_nuke.webp",
      thumbnail: "https://i.imgur.com/fJUkerQ.png",
      "description": "Usina nuclear. Design único, com duas bombas em andares diferentes. Famoso por sua verticalidade e paredes que podem ser atravessadas."
    },
    {
      name: "Train",
      radar: "/images/maps/map_train.webp",
      thumbnail: "https://i.imgur.com/SOAqj68.png",
      description: "Pátio de trens. Labirinto de vagões e trilhos, ideal para flancos e jogadas em equipe, com foco em confrontos rápidos."
    }
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