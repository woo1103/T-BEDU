#!/usr/bin/env node
// 운영 배포 — 점검을 모두 통과해야만 배포한다.
//
// 사용법 (english-exam-app 폴더에서):
//   npm run deploy               시험지 앱
//   npm run deploy -- student    학생 앱
//   npm run deploy -- all        둘 다
//
// 순서: ① 커밋 안 된 변경 없음 ② 원격(GitHub)에 푸시됨 ③ 타입 검사 ④ 테스트 ⑤ Vercel 운영 배포 ⑥ 운영 주소 접속 확인
// Vercel CLI는 커밋 여부와 상관없이 지금 폴더의 파일을 그대로 올리므로, ①②가 "올라가는 코드 = 커밋된 코드"를 보장한다.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const examDir = path.resolve(here, "..");
const APPS = {
  exam: {
    name: "시험지 앱",
    dir: examDir,
    url: "https://english-exam-app.vercel.app",
    checks: [
      ["타입 검사", "npx tsc --noEmit -p ."],
      ["테스트", "npx vitest run"],
    ],
  },
  student: {
    name: "학생 앱",
    dir: path.resolve(examDir, "../student-app"),
    url: "https://student-app-blush.vercel.app",
    checks: [["타입 검사", "npx tsc -b"]],
  },
};

const target = process.argv[2] ?? "exam";
const selected = target === "all" ? ["exam", "student"] : [target];
if (!selected.every((k) => k in APPS)) {
  console.error(`알 수 없는 대상: ${target} (exam | student | all)`);
  process.exit(1);
}

function run(cmd, cwd, { quiet = false } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" });
  return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n배포하지 않았습니다.`);
  process.exit(1);
}

function step(n, msg) {
  console.log(`\n[${n}] ${msg}`);
}

// ① 커밋 안 된 변경
step("1/6", "커밋 안 된 변경 확인");
for (const key of selected) {
  const { dir, name } = APPS[key];
  const st = run("git -c core.quotePath=false status --porcelain -- .", dir, { quiet: true });
  if (!st.ok) fail(`${name}: git 상태를 읽지 못했습니다.\n${st.out}`);
  const dirty = st.out.trim();
  if (dirty) {
    fail(`${name}에 커밋하지 않은 변경이 있습니다. 커밋(또는 되돌리기) 후 다시 실행하세요:\n${dirty}`);
  }
}
console.log("  깨끗함");

// ② 원격에 푸시됨
step("2/6", "GitHub에 푸시됐는지 확인");
run("git fetch --quiet", examDir, { quiet: true });
const ahead = run("git rev-list --count @{u}..HEAD", examDir, { quiet: true });
if (!ahead.ok) fail("현재 브랜치에 연결된 원격 브랜치가 없습니다. 먼저 git push -u origin <브랜치> 를 실행하세요.");
if (Number(ahead.out.trim()) > 0) {
  fail(`푸시하지 않은 커밋이 ${ahead.out.trim()}개 있습니다. git push 후 다시 실행하세요.`);
}
console.log("  푸시됨");

// ③④ 점검
let n = 3;
for (const key of selected) {
  const app = APPS[key];
  for (const [label, cmd] of app.checks) {
    step(`${n}/6`, `${app.name} ${label}`);
    if (!run(cmd, app.dir).ok) fail(`${app.name} ${label} 실패`);
  }
}
n = 5;

// ⑤ 배포, ⑥ 접속 확인
for (const key of selected) {
  const app = APPS[key];
  step(`5/6`, `${app.name} 운영 배포`);
  const dep = run("vercel --prod --yes", app.dir, { quiet: true });
  const ready = /"message":\s*"Deployment [^"]+ ready\."/.test(dep.out);
  if (!dep.ok || !ready) fail(`${app.name} 배포 실패:\n${dep.out.slice(-2000)}`);
  console.log("  배포 완료");

  step(`6/6`, `${app.name} 접속 확인 (${app.url})`);
  let status = 0;
  for (let i = 0; i < 3 && status !== 200; i++) {
    try {
      status = (await fetch(app.url, { redirect: "follow" })).status;
    } catch {
      status = 0;
    }
    if (status !== 200) await new Promise((r) => setTimeout(r, 3000));
  }
  if (status !== 200) fail(`${app.name} 운영 주소 응답 ${status || "없음"}. Vercel 대시보드에서 확인하세요.`);
  console.log(`  ${app.url} → 200`);
}

console.log(`\n✔ 배포 완료: ${selected.map((k) => APPS[k].name).join(", ")}`);
