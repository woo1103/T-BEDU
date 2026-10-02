import { parsePassage } from "../lib/passage-parser";

// 학생앱에서 지문을 시험지와 동일하게 렌더(어법 밑줄·삽입 마커·순서 단락 등).
// 선지는 Solve의 버튼으로 별도 렌더하므로 여기서는 "지문 본문"만 그린다.
export default function PassageView({
  passage,
  questionType,
}: {
  passage: string;
  questionType: string;
}) {
  const parsed = parsePassage(passage, questionType);

  if (parsed.type === "grammar") {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
          {parsed.parts.map((part, i) =>
            part.underlined ? (
              <span key={i}>
                <span className="font-bold text-xs align-super mr-0.5">
                  {part.marker}
                </span>
                <span className="underline decoration-1">{part.underlined}</span>
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </p>
      </div>
    );
  }

  if (parsed.type === "insertion") {
    return (
      <div className="mb-3 space-y-2">
        <div className="border-2 border-gray-700 rounded-lg p-3 bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {parsed.givenSentence}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {parsed.bodyParts.map((part, i) =>
              part.marker ? (
                <span key={i} className="font-bold mx-1">
                  ( {part.marker} )
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </p>
        </div>
      </div>
    );
  }

  if (parsed.type === "order") {
    return (
      <div className="mb-3 space-y-2">
        <div className="border-2 border-gray-700 rounded-lg p-3 bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {parsed.givenParagraph}
          </p>
        </div>
        {parsed.segments.map((seg, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
              <span className="font-bold mr-1">{seg.label}</span>
              {seg.text}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (parsed.type === "summary") {
    return (
      <div className="mb-3 space-y-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {parsed.mainPassage}
          </p>
        </div>
        <div className="border border-gray-300 rounded-lg p-3 bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {parsed.summaryText}
          </p>
        </div>
      </div>
    );
  }

  // writing / default: 인라인 밑줄(__..__)만 처리
  const text = parsed.type === "writing" ? parsed.passage : parsed.type === "default" ? parsed.text : passage;
  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
        {text}
      </p>
    </div>
  );
}
