import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 필요");
  process.exit(1);
}

const client = createClient({ url, authToken });

const sql = `
CREATE TABLE IF NOT EXISTS "Textbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
`;

try {
  await client.execute(sql);
  const check = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Textbook'"
  );
  console.log("✓ Textbook 테이블 확인:", check.rows);
} catch (e) {
  console.error("실패:", e);
  process.exit(1);
}
