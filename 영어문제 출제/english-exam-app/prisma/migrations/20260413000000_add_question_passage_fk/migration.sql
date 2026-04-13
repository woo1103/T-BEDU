-- AlterTable
ALTER TABLE "Question" ADD COLUMN "passageId" TEXT REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");
