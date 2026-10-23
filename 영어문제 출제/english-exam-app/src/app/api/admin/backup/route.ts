import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// 전체 DB 백업(관리자 전용) — 모든 테이블을 JSON 한 파일로 내려받는다.
// 표 단위로 스트리밍해 Vercel 응답 크기 제한(일반 응답 약 4.5MB)에 걸리지 않게 한다.
// 비밀번호 해시·학생 정보가 들어 있으므로 파일 보관에 주의.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// JSON으로 안전하게: BigInt → 숫자(범위 밖이면 문자열), 바이너리 → base64
function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value instanceof Uint8Array) return { base64: Buffer.from(value).toString("base64") };
  return value;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "권한 없음" }, { status: 403 });
  }

  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name NOT LIKE 'libsql_%' ORDER BY name"
  );

  const exportedAt = new Date().toISOString();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`{"exportedAt":${JSON.stringify(exportedAt)},"tableCount":${tables.length},"tables":{`)
        );
        for (let i = 0; i < tables.length; i++) {
          const name = tables[i].name;
          // 테이블 이름은 sqlite_master에서 온 값만 쓰고, 큰따옴표를 이스케이프해 식별자로 감싼다
          const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT * FROM "${name.replaceAll('"', '""')}"`
          );
          controller.enqueue(
            encoder.encode(`${i > 0 ? "," : ""}${JSON.stringify(name)}:${JSON.stringify(rows, replacer)}`)
          );
        }
        controller.enqueue(encoder.encode("}}"));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const stamp = exportedAt.slice(0, 16).replace(/[-:T]/g, "");
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tnbedu-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
