import { normalizeUnderlineTags, splitInlineUnderline } from "@/lib/passage-parser";

interface Props {
  text: string;
  className?: string;
}

export function PassageText({ text, className }: Props) {
  const normalized = normalizeUnderlineTags(text);
  const segments = splitInlineUnderline(normalized);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.blank ? (
          // 빈칸: 원본 밑줄 개수와 무관하게 넉넉한 고정 폭으로 표시
          <span
            key={i}
            aria-label="빈칸"
            className="inline-block w-[7em] border-b border-current align-baseline mx-0.5"
          >
            &nbsp;
          </span>
        ) : seg.underline ? (
          <u key={i}>{seg.text}</u>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
