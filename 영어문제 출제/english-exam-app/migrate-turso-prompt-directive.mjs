import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.vercel" });
config({ path: ".env.local" });

const client = createClient({
  url: (process.env.TURSO_DATABASE_URL || "").trim(),
  authToken: (process.env.TURSO_AUTH_TOKEN || "").trim(),
});

const tables = await client.execute(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='PromptDirective'`
);

if (tables.rows.length > 0) {
  console.log("PromptDirective 테이블이 이미 존재합니다. 건너뜁니다.");
} else {
  await client.execute(`
    CREATE TABLE "PromptDirective" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "scopeKey" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await client.execute(
    `CREATE INDEX "PromptDirective_scope_scopeKey_enabled_idx" ON "PromptDirective"("scope", "scopeKey", "enabled")`
  );
  console.log("✓ PromptDirective 테이블 생성 완료");
}

console.log("done.");
