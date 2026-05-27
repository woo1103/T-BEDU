// 계정 목록을 보고 username 을 admin 으로 승격시키는 스크립트
//
// 사용법:
//   1) 목록만 조회:        node --env-file=.env.local scripts/promote-admin.mjs
//   2) 특정 계정 승격:     node --env-file=.env.local scripts/promote-admin.mjs <username>
//   3) teacher 로 강등:    node --env-file=.env.local scripts/promote-admin.mjs <username> teacher

import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const username = process.argv[2];
  const role = process.argv[3] || "admin";

  if (!username) {
    const res = await db.execute(
      `SELECT username, role, createdAt FROM User ORDER BY createdAt ASC`
    );
    console.log("\n현재 계정 목록:");
    console.log("─".repeat(60));
    for (const row of res.rows) {
      const tag = row.role === "admin" ? "[admin]   " : "[teacher] ";
      const created = String(row.createdAt).slice(0, 10);
      console.log(`${tag} ${String(row.username).padEnd(20)} ${created}`);
    }
    console.log("─".repeat(60));
    console.log(`\n승격하려면: node --env-file=.env.local scripts/promote-admin.mjs <username>`);
    return;
  }

  if (!["admin", "teacher"].includes(role)) {
    console.error(`role 은 admin 또는 teacher 여야 합니다. (입력: ${role})`);
    process.exit(1);
  }

  const before = await db.execute({
    sql: `SELECT username, role FROM User WHERE username = ?`,
    args: [username],
  });
  if (before.rows.length === 0) {
    console.error(`'${username}' 계정을 찾을 수 없습니다.`);
    process.exit(1);
  }
  const prevRole = before.rows[0].role;
  if (prevRole === role) {
    console.log(`이미 role='${role}' 입니다. 변경 사항 없음.`);
    return;
  }

  await db.execute({
    sql: `UPDATE User SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE username = ?`,
    args: [role, username],
  });
  console.log(`'${username}' 의 role: ${prevRole} → ${role}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
