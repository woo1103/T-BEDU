// 과제 대상 학생: studentIds가 비어 있으면 반 전체, 있으면 그 학생들만
export function parseTargetIds(studentIds: string | null): string[] | null {
  if (!studentIds) return null;
  try {
    const ids = JSON.parse(studentIds);
    return Array.isArray(ids) && ids.length > 0 ? ids.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function isTarget(studentIds: string | null, studentId: string): boolean {
  const ids = parseTargetIds(studentIds);
  return ids === null || ids.includes(studentId);
}

// 한 학생을 빼고 남는 대상. 반 전체 과제면 지금 반 학생들에서 뺀다. 아무도 안 남으면 빈 배열(과제 삭제).
export function targetsWithout(studentIds: string | null, classStudentIds: string[], studentId: string): string[] {
  const current = parseTargetIds(studentIds) ?? classStudentIds;
  return current.filter((id) => id !== studentId);
}
