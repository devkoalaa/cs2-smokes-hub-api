-- Abertura em beta fechado: acesso por convite, grupos e links compartilhados por pessoa.
ALTER TABLE "users" ADD COLUMN "accessGrantedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "allowPreview" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "InviteKind" AS ENUM ('ACCESS', 'GROUP');

CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_members" (
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_members_pkey" PRIMARY KEY ("groupId","userId")
);
CREATE INDEX "group_members_userId_idx" ON "group_members"("userId");

CREATE TABLE "invites" (
    "code" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "groupId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "usesLeft" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "invites_groupId_idx" ON "invites"("groupId");

CREATE TABLE "match_shares" (
    "code" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_shares_pkey" PRIMARY KEY ("code")
);
CREATE UNIQUE INDEX "match_shares_matchId_userId_key" ON "match_shares"("matchId", "userId");

ALTER TABLE "groups" ADD CONSTRAINT "groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_shares" ADD CONSTRAINT "match_shares_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "tracked_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_shares" ADD CONSTRAINT "match_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
