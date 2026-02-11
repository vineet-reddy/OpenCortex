-- Add explicit source anchors for robust comment mapping/highlighting
ALTER TABLE "PaperComment"
ADD COLUMN "paragraphId" TEXT,
ADD COLUMN "sourceStart" INTEGER,
ADD COLUMN "sourceEnd" INTEGER;
