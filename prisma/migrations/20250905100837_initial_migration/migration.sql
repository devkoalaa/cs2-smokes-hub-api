-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED');
CREATE TYPE "public"."SmokeType" AS ENUM ('SMOKE', 'BANG', 'MOLOTOV', 'STRATEGY');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "steamId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."maps" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "radar" TEXT NOT NULL,

    CONSTRAINT "maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."smokes" (
    "id" SERIAL NOT NULL,
    "mapId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "type" "public"."SmokeType" NOT NULL DEFAULT 'SMOKE',
    "x_coord" DOUBLE PRECISION NOT NULL,
    "y_coord" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "smokes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ratings" (
    "id" SERIAL NOT NULL,
    "value" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "smokeId" INTEGER NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" SERIAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" INTEGER NOT NULL,
    "smokeId" INTEGER NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_steamId_key" ON "public"."users"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "maps_name_key" ON "public"."maps"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_userId_smokeId_key" ON "public"."ratings"("userId", "smokeId");

-- AddForeignKey
ALTER TABLE "public"."smokes" ADD CONSTRAINT "smokes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."smokes" ADD CONSTRAINT "smokes_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "public"."maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_smokeId_fkey" FOREIGN KEY ("smokeId") REFERENCES "public"."smokes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_smokeId_fkey" FOREIGN KEY ("smokeId") REFERENCES "public"."smokes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
