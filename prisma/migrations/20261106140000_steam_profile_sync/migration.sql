-- Nome e foto da Steam atualizados sem precisar de novo login.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "steamSyncedAt" TIMESTAMP(3);

