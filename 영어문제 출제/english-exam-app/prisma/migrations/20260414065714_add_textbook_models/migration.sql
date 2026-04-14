-- CreateTable
CREATE TABLE "Textbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "coverTemplate" TEXT NOT NULL DEFAULT 'classic',
    "pageTemplate" TEXT NOT NULL DEFAULT 'default',
    "themeColor" TEXT NOT NULL DEFAULT '#4FC3F7',
    "brandText" TEXT NOT NULL DEFAULT 'T&BEDU',
    "logoText" TEXT NOT NULL DEFAULT 'T',
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textbookId" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    CONSTRAINT "Chapter_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "Textbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TextbookPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "title" TEXT,
    CONSTRAINT "TextbookPage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "Block_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TextbookPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Chapter_textbookId_idx" ON "Chapter"("textbookId");

-- CreateIndex
CREATE INDEX "TextbookPage_chapterId_idx" ON "TextbookPage"("chapterId");

-- CreateIndex
CREATE INDEX "Block_pageId_idx" ON "Block"("pageId");
