// 테스트용 문항 생성기: 시드 고정 난수로 유형·길이가 다양한 문항을 만든다(실제 저장 형식과 동일).
import type { ExamItemData } from "@/components/pdf/ExamPDF";

const WORDS =
  "the of students research learning memory creative people often believe that important however suggests information decisions environment community researchers experience behavior technology society development understanding particularly significantly communication relationship approximately responsibility".split(
    " "
  );
const CIRCLES = "①②③④⑤";

export function makeItems(seed: number, count: number, maxSentences = 15): ExamItemData[] {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const sentence = () => {
    const w = Array.from({ length: 8 + Math.floor(rnd() * 16) }, () => pick(WORDS));
    w[0] = w[0][0].toUpperCase() + w[0].slice(1);
    return w.join(" ") + ".";
  };
  const para = (n: number) => Array.from({ length: n }, sentence).join(" ");
  const C = (texts: string[], correct: number) =>
    JSON.stringify(texts.map((t, i) => ({ label: CIRCLES[i], text: t, isCorrect: i === correct })));
  const choiceText = (long: boolean) =>
    long ? para(1) : Array.from({ length: 2 + Math.floor(rnd() * 4) }, () => pick(WORDS)).join(" ");
  const markers = C(["①", "②", "③", "④", "⑤"], 2);

  return Array.from({ length: count }, (_, i) => {
    const n = 2 + Math.floor(rnd() * (maxSentences - 1));
    const longChoices = rnd() < 0.3;
    const type = pick(["topic", "blank", "grammar", "order", "insertion", "summary", "writing", "title"]);
    let t = "naesin_topic";
    let q = "다음 글의 주제로 가장 적절한 것은?";
    let p = para(n);
    let c = C(Array.from({ length: 5 }, () => choiceText(longChoices)), 1);
    if (type === "blank") {
      t = "naesin_blank_sent";
      q = "다음 빈칸에 들어갈 말로 가장 적절한 것은?";
      p = para(Math.max(1, n - 1)) + " Therefore, _________. " + para(1);
    } else if (type === "grammar") {
      t = "29_grammar";
      q = "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?";
      const w = p.split(" ");
      [1, 3, 5, 7, 9].forEach((k, j) => {
        const idx = Math.min(w.length - 1, Math.floor((w.length * k) / 11));
        w[idx] = CIRCLES[j] + "<u>" + w[idx] + "</u>";
      });
      p = w.join(" ");
      c = markers;
    } else if (type === "order") {
      t = "36_order";
      q = "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?";
      const k = Math.ceil(n / 3);
      p = `[주어진 글] ${para(2)}\n(A) ${para(k)}\n(B) ${para(k)}\n(C) ${para(k)}`;
      c = C(["(A)-(C)-(B)", "(B)-(A)-(C)", "(B)-(C)-(A)", "(C)-(A)-(B)", "(C)-(B)-(A)"], 2);
    } else if (type === "insertion") {
      t = "38_insertion";
      q = "글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?";
      const k = Math.ceil(n / 4);
      p = `[주어진 문장] ${sentence()}\n\n[본문] ${para(2)} ① ${para(1)} ② ${para(k)} ③ ${para(1)} ④ ${para(k)} ⑤ ${para(1)}`;
      c = markers;
    } else if (type === "summary") {
      t = "40_summary";
      q = "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?";
      p = `[본문] ${para(n)}\n\n[요약문] ${sentence().replace(".", "")} ______(A)______ and ______(B)______.`;
      c = C(
        ["(A) developed … (B) explore", "(A) inherited … (B) ignore", "(A) measured … (B) memorize", "(A) limited … (B) combine", "(A) tested … (B) avoid"],
        0
      );
    } else if (type === "writing") {
      t = "naesin_writing";
      q = "다음 글의 빈칸에 주어진 조건에 맞게 영어로 쓰시오.";
      p = para(Math.ceil(n / 2)) + " ________________ " + sentence();
      c = "[]";
    } else if (type === "title") {
      t = "naesin_title";
      q = "다음 글의 제목으로 가장 적절한 것은?";
    }
    return {
      orderNum: i + 1,
      customPoints: null,
      question: { passage: p, question: q, choices: c, answer: "", points: rnd() < 0.3 ? 3 : 2, questionType: t },
    };
  });
}

// PDF 바이트에서 페이지 수 세기
export function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}
