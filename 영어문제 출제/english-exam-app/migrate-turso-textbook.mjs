import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.vercel" });
config({ path: ".env.local" });

const client = createClient({
  url: (process.env.TURSO_DATABASE_URL || "").trim(),
  authToken: (process.env.TURSO_AUTH_TOKEN || "").trim(),
});

async function exists(name) {
  const r = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [name],
  });
  return r.rows.length > 0;
}

async function indexExists(name) {
  const r = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
    args: [name],
  });
  return r.rows.length > 0;
}

const TABLES = [
  {
    name: "Textbook",
    sql: `CREATE TABLE "Textbook" (
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
    )`,
  },
  {
    name: "Chapter",
    sql: `CREATE TABLE "Chapter" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "textbookId" TEXT NOT NULL,
      "orderNum" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      CONSTRAINT "Chapter_textbookId_fkey" FOREIGN KEY ("textbookId") REFERENCES "Textbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    name: "TextbookPage",
    sql: `CREATE TABLE "TextbookPage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "chapterId" TEXT NOT NULL,
      "orderNum" INTEGER NOT NULL,
      "title" TEXT,
      CONSTRAINT "TextbookPage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    name: "Block",
    sql: `CREATE TABLE "Block" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "pageId" TEXT NOT NULL,
      "orderNum" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "data" TEXT NOT NULL,
      CONSTRAINT "Block_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TextbookPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
];

const INDEXES = [
  { name: "Chapter_textbookId_idx", sql: `CREATE INDEX "Chapter_textbookId_idx" ON "Chapter"("textbookId")` },
  { name: "TextbookPage_chapterId_idx", sql: `CREATE INDEX "TextbookPage_chapterId_idx" ON "TextbookPage"("chapterId")` },
  { name: "Block_pageId_idx", sql: `CREATE INDEX "Block_pageId_idx" ON "Block"("pageId")` },
];

for (const t of TABLES) {
  if (await exists(t.name)) {
    console.log(`- ${t.name}: 이미 존재 — 건너뜀`);
  } else {
    await client.execute(t.sql);
    console.log(`✓ ${t.name} 생성`);
  }
}

for (const i of INDEXES) {
  if (await indexExists(i.name)) {
    console.log(`- index ${i.name}: 이미 존재 — 건너뜀`);
  } else {
    await client.execute(i.sql);
    console.log(`✓ index ${i.name} 생성`);
  }
}

console.log("done.");
