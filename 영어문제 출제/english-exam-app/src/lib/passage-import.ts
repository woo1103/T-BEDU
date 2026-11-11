// 지문 PDF 가져오기: 쪽마다 AI가 읽은 지문을 화면의 '고칠 수 있는 목록'으로 모은다.
export interface DraftPassage {
  key: string;
  page: number; // 처음 나온 쪽
  lesson: string;
  title: string;
  content: string;
  include: boolean; // 저장할지
}

export interface ExtractedOnPage {
  lesson?: string;
  title?: string;
  content: string;
  continued: boolean;
}

// 두 조각 잇기: 앞이 문장 끝이면 문단을 나누고, 문장 중간에서 끊겼으면 한 칸 띄워 잇는다
export function joinParts(a: string, b: string): string {
  const left = a.replace(/\s+$/, "");
  const right = b.replace(/^\s+/, "");
  if (!left) return right;
  if (!right) return left;
  return /[.!?]["'”’)\]]?$/.test(left) ? `${left}\n\n${right}` : `${left} ${right}`;
}

// 한 쪽에서 읽은 지문을 목록에 더한다. 쪽 맨 위가 앞 쪽에서 이어지면 마지막 지문에 붙인다.
// 과·단원이 쪽에 안 보이면 바로 앞 지문의 과(없으면 기본값)를 이어 쓴다.
export function addPage(
  drafts: DraftPassage[],
  page: number,
  found: ExtractedOnPage[],
  defaultLesson: string
): DraftPassage[] {
  const out = [...drafts];
  found.forEach((p, i) => {
    const last = out[out.length - 1];
    if (i === 0 && p.continued && last) {
      out[out.length - 1] = { ...last, content: joinParts(last.content, p.content) };
      return;
    }
    out.push({
      key: `${page}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      page,
      lesson: p.lesson || last?.lesson || defaultLesson,
      title: p.title ?? "",
      content: p.content,
      include: true,
    });
  });
  return out;
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
