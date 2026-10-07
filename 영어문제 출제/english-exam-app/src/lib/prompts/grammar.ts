// 어법(단원/테마별) 전용 프롬프트. 주제/키워드(topic)에 문법 단원·테마를 넣어
// 그 포인트에 집중한 어법 문항만 생성한다.

const GRAMMAR_COMMON = `당신은 한국 고등학교 영어 어법 문제 출제 전문가입니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

\`\`\`json
{
  "passage": "영어 지문",
  "question": "발문 (한글)",
  "choices": [
    {"text": "선지 내용", "isCorrect": false},
    {"text": "선지 내용", "isCorrect": false},
    {"text": "선지 내용", "isCorrect": false},
    {"text": "선지 내용", "isCorrect": false},
    {"text": "선지 내용", "isCorrect": false}
  ],
  "explanation": "정답 해설 (한글)",
  "points": 2
}
\`\`\``;

const GRAMMAR_PROMPTS: Record<string, string> = {
  grammar_theme: `${GRAMMAR_COMMON}

이 문제는 "어법 — 단원/테마별 (어법상 틀린 것 찾기)" 유형입니다.

출제 지침:
- 사용자가 [주제/키워드]로 지정한 **문법 단원·테마에 집중**해 출제한다.
  (예: 관계사, 분사/분사구문, 시제, 수일치(주어-동사), to부정사 vs 동명사,
   가정법, 수동태, 병렬구조, 접속사 vs 전치사, 대명사 일치 등)
- 지문 속 어법 판단 대상 5곳에 ①~⑤ 번호 + 밑줄을 표시하고, 그중 **1곳만 어법상 틀리게** 한다.
- **틀린 1곳은 반드시 지정된 테마의 문법 오류**여야 하며, 나머지 4곳도 가능하면 같은/인접 테마로 구성해 변별력을 높인다.
- 발문: "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?"

passage 작성 규칙 (매우 중요):
- 어법 판단 대상 5곳 각각의 바로 앞에 번호 마커(①~⑤)를 공백 없이 붙인다: \`①expression\`, \`②expression\` ... (구는 첫 단어 앞)
- HTML 태그/마크다운 금지 — 렌더러가 자동으로 밑줄 처리.
- 번호는 반드시 지문 등장 순서대로 ①→⑤, 정확히 5개.

choices 작성 규칙:
- 선지 text는 **번호만**: "①", "②", "③", "④", "⑤"
- 어법상 틀린 번호의 isCorrect: true, 나머지 false
- explanation에 틀린 이유와 올바른 표현을 제시.`,

  grammar_theme_box: `${GRAMMAR_COMMON}

이 문제는 "어법 — 단원/테마별 (네모형 어법 선택)" 유형입니다.

출제 지침:
- 사용자가 [주제/키워드]로 지정한 **문법 단원·테마에 집중**해 출제한다.
- 지문 속 (A), (B), (C) 세 곳의 네모에서 각각 **어법에 맞는 표현**을 고르게 한다.
- 세 네모 모두 지정된 테마(또는 인접 테마)의 문법 포인트로 구성.
- 발문: "(A), (B), (C)의 각 네모 안에서 어법에 맞는 표현으로 가장 적절한 것은?"

passage 작성 규칙:
- 네모 부분은 \`(A) [ option1 / option2 ]\` 형식으로 지문에 삽입한다. (A)(B)(C) 순서대로.

choices 작성 규칙:
- 선지 5개는 각각 (A)-(B)-(C) 표현 조합을 text로 제시한다.
  예: "(A) which – (B) are – (C) to run"
- 어법상 모두 맞는 조합 1개만 isCorrect: true.`,
};

export function getGrammarPrompt(questionType: string): string | null {
  return GRAMMAR_PROMPTS[questionType] || null;
}
