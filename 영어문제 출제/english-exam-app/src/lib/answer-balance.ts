// 시험지 정답 번호(①~⑤) 분포 계산과 고르게 섞기 계획. DB와 무관한 순수 함수.

export const LABELS = ["①", "②", "③", "④", "⑤"];

export function distribution(positions: number[], slots = 5): number[] {
  const d = new Array(slots).fill(0);
  for (const p of positions) if (p >= 0 && p < slots) d[p]++;
  return d;
}

// 쏠림 판단: 가장 많은 번호와 가장 적은 번호 차이가 3 이상이거나, 한 번호가 40%를 넘으면(5문항 이상일 때)
export function isSkewed(dist: number[]): boolean {
  const total = dist.reduce((a, b) => a + b, 0);
  if (total < 5) return false;
  const max = Math.max(...dist);
  return max - Math.min(...dist) >= 3 || max / total > 0.4;
}

/**
 * 바꿀 수 있는 문항(movable)의 정답 위치만 옮겨 분포를 고르게 한다.
 * 가장 많은 번호의 문항 하나를 가장 적은 번호로 옮기는 것을 차이가 1 이하가 될 때까지(또는 더 못 옮길 때까지) 반복.
 * 반환: 문항별 새 정답 위치(바뀌지 않은 문항은 그대로).
 */
export function planBalance(positions: number[], movable: boolean[], slots = 5): number[] {
  const next = positions.slice();
  const dist = distribution(next, slots);
  for (let guard = 0; guard < positions.length * slots; guard++) {
    const max = Math.max(...dist);
    const min = Math.min(...dist);
    if (max - min <= 1) break;
    const to = dist.indexOf(min);
    // 가장 많은 번호들 중, 옮길 수 있는 문항이 있는 번호에서 하나를 옮긴다
    let moved = false;
    for (let from = 0; from < slots && !moved; from++) {
      if (dist[from] !== max) continue;
      const i = next.findIndex((p, k) => p === from && movable[k]);
      if (i >= 0) {
        next[i] = to;
        dist[from]--;
        dist[to]++;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

// 정답 위치를 from → to 로 옮긴다: 두 선지의 자리를 맞바꾼다(나머지 선지 순서는 유지).
export function moveCorrect<T>(choices: T[], from: number, to: number): T[] {
  const out = choices.slice();
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}
