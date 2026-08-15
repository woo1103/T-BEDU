import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
);
console.log("테이블 목록:", tables.rows.map(r => r.name));

const cols = await client.execute("PRAGMA table_info('Textbook')");
console.log("Textbook 컬럼:", cols.rows);

const count = await client.execute("SELECT COUNT(*) as c FROM Textbook");
console.log("Textbook 행수:", count.rows[0].c);
