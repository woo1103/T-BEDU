import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.vercel" });
config({ path: ".env.local" });

const client = createClient({
  url: (process.env.TURSO_DATABASE_URL || "").trim(),
  authToken: (process.env.TURSO_AUTH_TOKEN || "").trim(),
});

// User 테이블 존재 여부 확인
const tables = await client.execute(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='User'`
);

if (tables.rows.length > 0) {
  console.log("User 테이블이 이미 존재합니다. 건너뜁니다.");
} else {
  await client.execute(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'teacher',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("OK: User 테이블 생성");

  await client.execute(
    `CREATE UNIQUE INDEX "User_username_key" ON "User"("username")`
  );
  console.log("OK: User_username_key 인덱스 생성");
}

console.log("\nTurso User 마이그레이션 완료.");
