-- Banner do perfil (mapa ou imagem enviada), foto do grupo e vínculo com o Discord.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bannerMap" TEXT,
ADD COLUMN     "discordCode" TEXT,
ADD COLUMN     "discordCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "discordDm" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "discordName" TEXT;

-- CreateTable
CREATE TABLE "images" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "groupId" INTEGER,

    CONSTRAINT "images_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "images_userId_key" ON "images"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "images_groupId_key" ON "images"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "users_discordCode_key" ON "users"("discordCode");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

