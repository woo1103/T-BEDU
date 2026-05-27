// 계정 목록을 보고 username 을 admin 으로 승격시키는 스크립트
//
// 사용법:
//   1) 목록만 조회:        node --env-file=.env.local scripts/promote-admin.mjs
//   2) 특정 계정 승격:     node --env-file=.env.local scripts/promote-admin.mjs <username>
//   3) teacher 로 강등:    node --env-file=.env.local scripts/promote-admin.mjs <username> teacher

import { PrismaClient } from "../src/generated/prisma/client/index.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.argv[2];
  const role = process.argv[3] || "admin";

  if (!username) {
    const users = await prisma.user.findMany({
      select: { username: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("\n현재 계정 목록:");
    console.log("─".repeat(60));
    for (const u of users) {
      const tag = u.role === "admin" ? "[admin]   " : "[teacher] ";
      console.log(`${tag} ${u.username.padEnd(20)} ${u.createdAt.toISOString().slice(0, 10)}`);
    }
    console.log("─".repeat(60));
    console.log(`\n승격하려면: node --env-file=.env.local scripts/promote-admin.mjs <username>`);
    return;
  }

  if (!["admin", "teacher"].includes(role)) {
    console.error(`role 은 admin 또는 teacher 여야 합니다. (입력: ${role})`);
    process.exit(1);
  }

  const before = await prisma.user.findUnique({ where: { username } });
  if (!before) {
    console.error(`'${username}' 계정을 찾을 수 없습니다.`);
    process.exit(1);
  }
  if (before.role === role) {
    console.log(`이미 role='${role}' 입니다. 변경 사항 없음.`);
    return;
  }

  await prisma.user.update({ where: { username }, data: { role } });
  console.log(`'${username}' 의 role: ${before.role} → ${role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
