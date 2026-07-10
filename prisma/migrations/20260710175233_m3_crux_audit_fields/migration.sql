-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "auditJson" JSONB,
ADD COLUMN     "auditVerdict" TEXT,
ADD COLUMN     "canonicalTopic" TEXT,
ADD COLUMN     "crux" TEXT;
