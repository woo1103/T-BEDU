import { NextRequest, NextResponse, after } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { isValidJobKey, kickJob, runJobStep } from "@/lib/gen-jobs";

// 문항 하나 처리 시간(재생성·검수 포함)을 넉넉히
export const maxDuration = 300;

// 생성 작업 한 단계 실행. 서버가 다음 단계를 스스로 부를 때는 작업 열쇠로, 화면에서는 로그인으로 들어온다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidJobKey(id, request.headers.get("x-gen-job-key")) && !(await requireStaff())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const origin = request.nextUrl.origin;
  // 응답은 바로 돌려주고, 문항 만들기는 응답 뒤에 이어서 한다
  after(async () => {
    const left = await runJobStep(id);
    if (left > 0) await kickJob(origin, id);
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
