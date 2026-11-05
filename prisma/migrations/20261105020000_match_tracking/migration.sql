-- CreateEnum
CREATE TYPE "public"."MatchImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "public"."match_tracking" (
    "userId" INTEGER NOT NULL,
    "authCodeEncrypted" TEXT NOT NULL,
    "lastShareCode" TEXT NOT NULL,
    "seedPending" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "nextPollAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_tracking_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."tracked_matches" (
    "id" SERIAL NOT NULL,
    "shareCode" TEXT NOT NULL,
    "valveMatchId" TEXT,
    "status" "public"."MatchImportStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "map" TEXT,
    "playedAt" TIMESTAMP(3),
    "rounds" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_requests" (
    "userId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,

    CONSTRAINT "match_requests_pkey" PRIMARY KEY ("userId","matchId")
);

-- CreateTable
CREATE TABLE "public"."match_players" (
    "matchId" INTEGER NOT NULL,
    "steamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "headshots" INTEGER,
    "damage" INTEGER,
    "rounds" INTEGER NOT NULL,
    "scoreFor" INTEGER NOT NULL,
    "scoreAgainst" INTEGER NOT NULL,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("matchId","steamId")
);

-- CreateTable
CREATE TABLE "public"."tracking_worker" (
    "id" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_worker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_matches_shareCode_key" ON "public"."tracked_matches"("shareCode");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_matches_valveMatchId_key" ON "public"."tracked_matches"("valveMatchId");

-- CreateIndex
CREATE INDEX "tracked_matches_status_retryAt_idx" ON "public"."tracked_matches"("status", "retryAt");

-- CreateIndex
CREATE INDEX "match_players_steamId_idx" ON "public"."match_players"("steamId");

-- AddForeignKey
ALTER TABLE "public"."match_tracking" ADD CONSTRAINT "match_tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_requests" ADD CONSTRAINT "match_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_requests" ADD CONSTRAINT "match_requests_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."tracked_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_players" ADD CONSTRAINT "match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."tracked_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
