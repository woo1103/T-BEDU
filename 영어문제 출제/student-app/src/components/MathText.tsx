import katex from "katex";
import "katex/dist/katex.min.css";

// $...$ (인라인) / $$...$$ (블록) 수식을 KaTeX로 렌더. 나머지는 텍스트(줄바꿈 유지).
// 시험지 앱(english-exam-app)의 MathText와 같은 규칙.
function renderSegment(seg: string, display: boolean): string {
  try {
    return katex.renderToString(seg, { displayMode: display, throwOnError: false });
  } catch {
    return seg;
  }
}

export default function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const parts: { html?: string; text?: string }[] = [];
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ html: renderSegment(m[1], true) });
    else parts.push({ html: renderSegment(m[2], false) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.html !== undefined ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: p.html }} />
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {p.text}
          </span>
        )
      )}
    </span>
  );
}
