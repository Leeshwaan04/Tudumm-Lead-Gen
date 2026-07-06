-- CreateTable
CREATE TABLE "trending_keywords" (
    "id" TEXT NOT NULL,
    "geo" TEXT NOT NULL DEFAULT 'IN',
    "keyword" TEXT NOT NULL,
    "approxTraffic" INTEGER NOT NULL DEFAULT 0,
    "trafficLabel" TEXT NOT NULL DEFAULT '',
    "isFinance" BOOLEAN NOT NULL DEFAULT false,
    "newsTitle" TEXT,
    "newsUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_keywords" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'capital-markets',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capturePageId" TEXT,
    "landingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_snapshots" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'autocomplete',
    "meta" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trending_keywords_geo_isFinance_lastSeenAt_idx" ON "trending_keywords"("geo", "isFinance", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "trending_keywords_geo_keyword_key" ON "trending_keywords"("geo", "keyword");

-- CreateIndex
CREATE INDEX "tracked_keywords_workspaceId_active_idx" ON "tracked_keywords"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_keywords_workspaceId_keyword_key" ON "tracked_keywords"("workspaceId", "keyword");

-- CreateIndex
CREATE INDEX "keyword_snapshots_keywordId_capturedAt_idx" ON "keyword_snapshots"("keywordId", "capturedAt");

-- AddForeignKey
ALTER TABLE "tracked_keywords" ADD CONSTRAINT "tracked_keywords_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_snapshots" ADD CONSTRAINT "keyword_snapshots_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "tracked_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;
