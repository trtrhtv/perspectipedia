-- AlterTable
ALTER TABLE "LensProfile" ADD COLUMN     "exemplars" JSONB,
ADD COLUMN     "lexicon" JSONB,
ADD COLUMN     "scope" TEXT;
