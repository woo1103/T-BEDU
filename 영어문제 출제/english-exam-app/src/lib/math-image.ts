// 브라우저가 잘라 보낸 문항 이미지(base64) → DB(MathImage)에 넣을 형태로 검사·변환
export const MATH_IMAGE_MAX_BYTES = 1_500_000; // 한 장 1.5MB 넘으면 거부(브라우저가 축소·압축해서 보냄)

export interface MathImageInput {
  base64: string; // data: 접두어 없이
  mime: string; // image/jpeg | image/png
  width?: number;
  height?: number;
}

export function decodeMathImage(
  img: MathImageInput
): { data: Uint8Array<ArrayBuffer>; mime: string; width: number | null; height: number | null } | string {
  if (!img?.base64 || !["image/jpeg", "image/png"].includes(img.mime)) return "이미지 형식 오류(JPEG/PNG)";
  const buf = Buffer.from(img.base64, "base64");
  if (buf.length === 0) return "빈 이미지";
  if (buf.length > MATH_IMAGE_MAX_BYTES) return "이미지가 너무 큽니다";
  const data = new Uint8Array(buf); // Prisma Bytes는 Buffer가 아닌 Uint8Array
  const n = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
  return { data, mime: img.mime, width: n(img.width), height: n(img.height) };
}
