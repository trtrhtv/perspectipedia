-- CreateTable
CREATE TABLE "LensProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'he',
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canon" JSONB NOT NULL,
    "register" TEXT NOT NULL,
    "internalDebates" JSONB NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'first-person',
    "redFlags" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensProfile_key_key" ON "LensProfile"("key");
