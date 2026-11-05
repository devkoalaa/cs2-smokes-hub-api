-- AlterTable
ALTER TABLE "public"."maps" 
ADD COLUMN "radarLower" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."smokes" ADD COLUMN "floor" TEXT;

-- AlterTable
ALTER TABLE "public"."maps" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."smokes" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reports_reporterId_smokeId_key" ON "public"."reports"("reporterId", "smokeId");

