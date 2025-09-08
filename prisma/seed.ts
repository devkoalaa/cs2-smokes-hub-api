import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const maps = [
    {
      name: "Dust2",
      radar: "/images/maps/map_dust2.webp",
      thumbnail: "https://static.wikia.nocookie.net/cswikia/images/1/16/Cs2_dust2.png",
      description: "O mais clássico. Duas bombas, uma rota central. Perfeito para duelos rápidos e jogabilidade direta."
    },
    {
      name: "Mirage",
      radar: "/images/maps/map_mirage.webp",
      thumbnail: "https://static.wikia.nocookie.net/cswikia/images/f/f5/De_mirage_cs2.png",
      description: "Icônico e equilibrado. Cenário de deserto com rotas claras, ideal para qualquer estilo de jogo."
    },
    {
      name: "Inferno",
      radar: "/images/maps/map_inferno.webp",
      "thumbnail": "https://static.wikia.nocookie.net/cswikia/images/1/17/Cs2_inferno_remake.png",
      description: "Vila italiana. Ruas estreitas e corredores que favorecem táticas com granadas e confrontos de perto."
    },
    {
      name: "Ancient",
      radar: "/images/maps/map_ancient.webp",
      thumbnail: "https://static.wikia.nocookie.net/cswikia/images/5/5c/De_ancient_cs2.png",
      description: "Ruínas antigas. Terreno irregular e áreas de bomba separadas, exigindo controle tático e uso de utilitários."
    },
    {
      name: "Nuke",
      radar: "/images/maps/map_nuke.webp",
      thumbnail: "https://static.wikia.nocookie.net/cswikia/images/d/d6/De_nuke_cs2.png",
      "description": "Usina nuclear. Design único, com duas bombas em andares diferentes. Famoso por sua verticalidade e paredes que podem ser atravessadas."
    },
    {
      name: "Train",
      radar: "/images/maps/map_train.webp",
      thumbnail: "https://static.wikia.nocookie.net/cswikia/images/2/2c/De_train_cs2_new.png",
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