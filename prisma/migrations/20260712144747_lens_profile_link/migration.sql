-- AlterTable
ALTER TABLE "Lens" ADD COLUMN     "profileKey" TEXT,
ADD COLUMN     "profileVersion" INTEGER;

-- CreateIndex
CREATE INDEX "Lens_profileKey_idx" ON "Lens"("profileKey");
