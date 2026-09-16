import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push";

// 학생 앱이 푸시 구독에 사용할 VAPID 공개키 (공개 정보)
export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}
