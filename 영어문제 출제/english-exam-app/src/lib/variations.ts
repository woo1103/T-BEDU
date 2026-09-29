// 고난도 "변형 갈래": 선지를 무작정 길게 만드는 대신, 본문/선지에
// 함정을 심는 변형 지시를 선택적으로 프롬프트에 주입한다.

export interface VariationDef {
  key: string;
  label: string;
  desc: string;
  instruction: string;
}

export const VARIATIONS: VariationDef[] = [
  {
    key: "negation",
    label: "부정어 혼동",
    desc: "빈칸/어휘에 without·give up·not 등 반대가 될 단어를 더해 혼동",
    instruction:
      "빈칸·어휘·요지 관련 문항이라면, 매력적 오답에 not/without/give up/hardly/rarely 등 부정·반전 표현을 더해 정답과 정반대 의미가 되도록 함정을 만든다. 지문에도 이중부정이나 부정어를 자연스럽게 배치해 표면적 단서만으로는 못 풀게 한다.",
  },
  {
    key: "near_synonym",
    label: "유사어 변별",
    desc: "비슷한 말 같은데 고르기 어렵게",
    instruction:
      "정답과 오답을 의미가 매우 근접한 유사 표현으로 구성해, 미묘한 뉘앙스·강도·범위 차이로만 정답이 갈리도록 한다. 한눈에 배제되는 오답을 두지 말 것.",
  },
  {
    key: "long_choices",
    label: "긴 선지",
    desc: "선지를 매우 길고 정교하게",
    instruction:
      "선지를 길고 정교한 문장으로 구성하되, 각 선지가 지문의 서로 다른 부분을 근거로 삼아 꼼꼼히 대조해야 판단되도록 한다. 길이만 늘리지 말고 내용 밀도를 높인다.",
  },
  {
    key: "contradict_passage",
    label: "본문 상반내용",
    desc: "본문에 비슷하거나 상반된 내용을 추가",
    instruction:
      "지문에 정답과 비슷하지만 결이 다른 내용, 또는 상반된 관점을 한 문장 덧붙여, 학생이 근거 문장을 정확히 짚지 않으면 헷갈리도록 만든다. 단, 정답의 논리적 근거는 지문 안에 분명히 존재해야 한다.",
  },
  {
    key: "negative_prompt",
    label: "부정 발문",
    desc: "'적절한 것' ↔ '적절하지 않은 것'으로 발문 뒤집기",
    instruction:
      "발문을 '가장 적절한 것'이 아니라 '적절하지 않은 것' 또는 '일치하지 않는 것'을 고르게 뒤집어, 4개는 옳고 1개만 틀리도록 구성한다. 발문에 '않은'을 명확히 표시한다.",
  },
  {
    key: "paraphrase_trap",
    label: "패러프레이즈 함정",
    desc: "정답은 동의어로 숨기고 오답은 지문 표현을 그대로",
    instruction:
      "정답 선지는 지문 표현을 동의어·구문 변형(패러프레이즈)으로 바꿔 숨기고, 매력적 오답은 지문의 단어·구절을 그대로 가져와 표면적으로 더 정답처럼 보이게 한다.",
  },
  {
    key: "partial_truth",
    label: "부분적 진실 오답",
    desc: "지문에 나오지만 질문과 무관·범위 초과인 오답",
    instruction:
      "오답 선지를 '지문에 실제로 언급되지만 질문이 묻는 초점과는 무관하거나 지나치게 일반화/범위 초과'인 내용으로 구성해, 지문에 있다는 이유만으로 고르면 틀리게 한다.",
  },
  {
    key: "logic_reverse",
    label: "논리관계 역전",
    desc: "인과·대조·조건을 미세하게 뒤집기",
    instruction:
      "오답에서 인과관계(원인↔결과), 대조, 조건을 미세하게 뒤바꾸거나 조건을 누락시켜, 논리 구조를 정확히 이해해야만 정답을 고르도록 한다.",
  },
  {
    key: "quantifier",
    label: "수량·정도 조작",
    desc: "some↔all, often↔always 등 미세 변형",
    instruction:
      "오답에 some↔all, often↔always, may↔must, 비교급·수치 등 정도·수량 표현을 미세하게 바꿔, 단정의 강도 차이로 오답이 되도록 한다.",
  },
  {
    key: "reference_confuse",
    label: "지시어 지칭 혼동",
    desc: "it/they/this가 가리키는 대상을 여러 개 심기",
    instruction:
      "지문에 it/they/this/that 등 지시어가 가리킬 후보를 복수로 배치해, 지칭 대상을 정확히 추적해야 정답을 고를 수 있도록 한다.",
  },
];

const BY_KEY = new Map(VARIATIONS.map((v) => [v.key, v]));

// 선택된 변형 갈래를 프롬프트 지시 블록으로 변환
export function buildVariationBlock(keys: string[] | undefined): string {
  if (!keys || keys.length === 0) return "";
  const picked = keys.map((k) => BY_KEY.get(k)).filter((v): v is VariationDef => !!v);
  if (picked.length === 0) return "";
  const lines = picked.map((v, i) => `${i + 1}. (${v.label}) ${v.instruction}`);
  return (
    "\n\n[고난도 변형 지시 — 아래 기법을 적용해 변별력을 높인다]\n" +
    lines.join("\n") +
    "\n※ 단, 정답은 지문 근거로 명확히 하나여야 하며, 변형이 오답 논란을 만들지 않게 한다."
  );
}
