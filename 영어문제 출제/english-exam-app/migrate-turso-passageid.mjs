import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.vercel" });
config({ path: ".env.local" });

const client = createClient({
  url: (process.env.TURSO_DATABASE_URL || "").trim(),
  authToken: (process.env.TURSO_AUTH_TOKEN || "").trim(),
});

// 기존 컬럼 확인
const info = await client.execute(`PRAGMA table_info("Question")`);
const hasPassageId = info.rows.some((r) => r.name === "passageId");

if (hasPassageId) {
  console.log("passageId 컬럼이 이미 존재합니다. 건너뜁니다.");
} else {
  await client.execute(
    `ALTER TABLE "Question" ADD COLUMN "passageId" TEXT REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE`
  );
  console.log("OK: Question.passageId 컬럼 추가");
}

await client.execute(
  `CREATE INDEX IF NOT EXISTS "Question_passageId_idx" ON "Question"("passageId")`
);
console.log("OK: Question_passageId_idx 인덱스 보장");

console.log("\nTurso 마이그레이션 완료.");
