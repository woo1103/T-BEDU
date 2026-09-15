import { prisma } from "@/lib/db";

// 혼동하기 쉬운 문자(0/O, 1/I/L) 제외
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateClassCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

// DB에서 유일한 반 코드를 생성 (충돌 시 재시도, 극단적 충돌이면 길이 +1)
export async function generateUniqueClassCode(len = 6): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateClassCode(len);
    const exists = await prisma.class.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return generateUniqueClassCode(len + 1);
}
