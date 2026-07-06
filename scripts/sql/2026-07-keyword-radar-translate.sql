-- English translation columns for vernacular trending keywords.
-- Run manually on Railway prod (deploys do not run prisma db push).
ALTER TABLE trending_keywords
  ADD COLUMN IF NOT EXISTS "keywordEn"   TEXT,
  ADD COLUMN IF NOT EXISTS "newsTitleEn" TEXT,
  ADD COLUMN IF NOT EXISTS "lang"        TEXT;
