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
        seg.underline ? (
          <u key={i}>{seg.text}</u>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
