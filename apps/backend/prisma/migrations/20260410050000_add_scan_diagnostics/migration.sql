ALTER TABLE "ScanJob"
ADD COLUMN "diagnostics" JSONB;

ALTER TABLE "ScanCandidate"
ADD COLUMN "diagnostics" JSONB;
