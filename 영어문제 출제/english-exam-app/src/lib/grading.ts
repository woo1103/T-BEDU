// 문항의 정답 라벨을 구한다. answer 필드 우선, 없으면 choices의 isCorrect에서 도출.
export function correctLabel(question: {
  answer: string;
  choices: string;
}): string | null {
  if (question.answer && question.answer.trim()) return question.answer.trim();
  try {
    const parsed = JSON.parse(question.choices) as {
      label: string;
      isCorrect: boolean;
    }[];
    const c = parsed.find((x) => x.isCorrect);
    return c?.label ?? null;
  } catch {
    return null;
  }
}
