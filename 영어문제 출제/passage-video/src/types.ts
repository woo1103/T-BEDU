/**
 * 지문 시각화 영상의 입력 스펙.
 * 스킬이 지문을 읽고 이 JSON만 만들어 주면 영상이 나온다.
 * 코드를 새로 쓸 필요가 없도록 캐릭터도 "프리셋 조합"으로 표현한다.
 */

export type HairStyle =
  | "short"
  | "bob"
  | "ponytail"
  | "curly"
  | "bun"
  | "bald"
  | "spiky"
  | "long"
  | "braids";

export type Outfit =
  | "tshirt"
  | "labcoat"
  | "suit"
  | "apron"
  | "hoodie"
  | "robe"
  | "dress"
  | "uniform";

export type Accessory =
  | "none"
  | "glasses"
  | "roundGlasses"
  | "cap"
  | "hat"
  | "crown"
  | "headband"
  | "earmuffs";

export type FacialHair = "none" | "beard" | "mustache";

export type Build = "slim" | "normal" | "stout";

export type HeldProp =
  | "none"
  | "book"
  | "flask"
  | "coin"
  | "phone"
  | "leaf"
  | "pen"
  | "basket"
  | "lamp";

/**
 * 목소리 설정. Google Cloud TTS 의 실제 목소리 이름을 쓴다.
 * 사용 가능한 목록은 `node scripts/voices.mjs` 로 확인한다.
 */
export type VoiceConfig = {
  /** 예: "ko-KR-Neural2-A" */
  name: string;
  /** 말하는 속도. 1이 기본, 0.85면 차분하게 */
  rate?: number;
  /** 음높이 반음 단위. 음수면 낮고 차분해진다 */
  pitch?: number;
};

/** 지문마다 새로 뽑는 캐릭터. 조합만 바꿔도 전혀 다른 인물이 된다. */
export type CharacterPreset = {
  /** 화면에 표시할 이름 (예: "린다", "연구자", "상인") */
  name?: string;
  /** 이 인물의 목소리. 성별·연령·성격에 맞게 배정한다 */
  voice?: VoiceConfig;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  outfit: Outfit;
  outfitColor: string;
  /** 옷의 보조색 (소매/앞치마 끈/넥타이 등) */
  accentColor?: string;
  accessory?: Accessory;
  facialHair?: FacialHair;
  build?: Build;
  /** 손에 든 물건 */
  prop?: HeldProp;
};

export type Expression =
  | "neutral"
  | "happy"
  | "surprised"
  | "thinking"
  | "confused"
  | "sad"
  | "excited";

export type Pose =
  | "idle"
  | "point"
  | "raise"
  | "shrug"
  | "think"
  | "present"
  | "cheer";

/** 씬에 등장하는 캐릭터 배치 */
export type CharacterOnStage = {
  /** spec.characters 의 키 */
  who: string;
  expression?: Expression;
  pose?: Pose;
  /** 말하는 중이면 입이 움직인다 */
  talking?: boolean;
  /** 좌우 반전 */
  flip?: boolean;
  /** 화면상 키 (px). 기본 420 */
  height?: number;
};

/** 모든 씬이 공유하는 필드 */
type SceneBase = {
  /**
   * 3인칭 나레이터 자막 (하단 밴드).
   * 인물을 "미나는 …", "필자는 …" 처럼 바깥에서 서술한다.
   */
  narration?: string;
  /**
   * 대사가 모두 끝난 뒤 다시 3인칭으로 돌아와 마무리하는 자막.
   * dialogue / hook / story 씬에서만 의미가 있다.
   */
  narrationOut?: string;
  /** 대응되는 영어 원문 한 줄 (선택) */
  english?: string;
  /** 프레임 수를 직접 지정. 없으면 나레이션 길이로 자동 계산 */
  durationInFrames?: number;
};

/** 인물이 직접 말하는 1인칭 대사 */
export type SpeechLine = {
  /** spec.characters 의 키 */
  who: string;
  /** 1인칭으로 쓴다: "어제… 뭐 먹었지?" */
  text: string;
  /** 소리 내지 않은 속마음이면 true (생각풍선 + 점선 자막) */
  thought?: boolean;
};

export type TitleScene = SceneBase & {
  type: "title";
  title: string;
  subtitle?: string;
  /** 표지에 세울 캐릭터들 */
  cast?: CharacterOnStage[];
};

/** 캐릭터가 질문을 던져 흥미를 여는 씬 */
export type HookScene = SceneBase & {
  type: "hook";
  /** 1인칭 질문. 자막도 이때 1인칭으로 전환된다 */
  question: string;
  cast: CharacterOnStage[];
  /** 속마음으로 던지는 질문이면 true */
  thought?: boolean;
};

/** 두 캐릭터가 주고받는 대화 (스토리텔링 지문의 핵심) */
export type DialogueScene = SceneBase & {
  type: "dialogue";
  /** 1인칭 대사들. 한 줄씩 순서대로 나온다 */
  lines: SpeechLine[];
  cast: CharacterOnStage[];
  /** 배경 분위기 */
  setting?: SettingKind;
};

/** 필자가 겪은 상황을 한 컷 만화처럼 재현 */
export type StoryScene = SceneBase & {
  type: "story";
  /** 장면 설명 캡션 (상단) — 3인칭 서술 */
  caption?: string;
  cast: CharacterOnStage[];
  setting?: SettingKind;
  /** 화면에 띄울 효과 문자 (예: "쿵!", "?!") */
  sfx?: string;
  /** 이 컷에서 인물이 한마디 던진다면 (1인칭 전환) */
  speech?: SpeechLine;
};

export type SettingKind =
  | "plain"
  | "room"
  | "classroom"
  | "outdoor"
  | "street"
  | "night"
  | "lab"
  | "market"
  | "library";

/** 핵심 개념 한 장 */
export type ConceptScene = SceneBase & {
  type: "concept";
  term: string;
  meaning: string;
  /** 개념을 상징하는 이모지/문자 아이콘 */
  icon?: string;
  cast?: CharacterOnStage[];
};

/** A vs B 대조 — 학술 지문에서 가장 자주 쓰인다 */
export type CompareScene = SceneBase & {
  type: "compare";
  heading?: string;
  left: { label: string; points: string[]; icon?: string };
  right: { label: string; points: string[]; icon?: string };
  cast?: CharacterOnStage[];
};

/** 원인 → 결과 흐름 */
export type FlowScene = SceneBase & {
  type: "flow";
  heading?: string;
  steps: { label: string; icon?: string }[];
  cast?: CharacterOnStage[];
};

/** 간단한 수치 비교 막대 */
export type BarsScene = SceneBase & {
  type: "bars";
  heading?: string;
  unit?: string;
  bars: { label: string; value: number; note?: string }[];
  cast?: CharacterOnStage[];
};

/** 지문 개념을 일상 사물에 비유 */
export type AnalogyScene = SceneBase & {
  type: "analogy";
  heading?: string;
  concept: { label: string; icon?: string };
  everyday: { label: string; icon?: string };
  /** 왜 같은가 */
  because: string;
  cast?: CharacterOnStage[];
};

/** 영어 원문 한 문장을 크게 보여주고 해석 */
export type QuoteScene = SceneBase & {
  type: "quote";
  sentence: string;
  translation: string;
  /** 굵게 강조할 단어들 */
  highlight?: string[];
};

/** 마무리 3줄 요약 */
export type RecapScene = SceneBase & {
  type: "recap";
  heading?: string;
  points: string[];
  cast?: CharacterOnStage[];
};

export type Scene =
  | TitleScene
  | HookScene
  | DialogueScene
  | StoryScene
  | ConceptScene
  | CompareScene
  | FlowScene
  | BarsScene
  | AnalogyScene
  | QuoteScene
  | RecapScene;

/**
 * 학원 브랜딩. 지문마다 바뀌지 않으므로 input/brand.json 한 곳에서 관리하고
 * 렌더 스크립트가 자동으로 끼워 넣는다.
 */
export type Brand = {
  /** 학원명 */
  name: string;
  /** public/ 안의 로고 파일명 (예: "logo.png"). 없으면 이니셜 모노그램으로 대체 */
  logo?: string;
  /** 로고 아래 한 줄 문구 */
  tagline?: string;
  /** 인트로 배경에 쓰는 브랜드 색 */
  color?: string;
  /**
   * 3인칭 나레이터 목소리. 모든 영상에서 동일하게 유지된다.
   * 차분하고 따뜻한 여성 톤으로 고정한다.
   */
  narratorVoice?: VoiceConfig;
  /** public/ 안의 배경음악 파일명 (예: "bgm.mp3"). 없으면 배경음악 없이 렌더된다 */
  bgm?: string;
  /** 배경음악 볼륨 (0~1). 기본 0.07 — 나레이션을 가리지 않는 수준 */
  bgmVolume?: number;
};

/** 생성된 음성 한 조각 */
export type AudioClip = {
  /** public/ 기준 상대 경로 (예: "audio/sample-academic/s1-narration.mp3") */
  file: string;
  seconds: number;
};

/**
 * 씬별 음성 모음. `scripts/tts.mjs` 가 만들어 `input/<slug>.audio.json` 에 저장하고,
 * 렌더 시 자동으로 주입된다. 키 형식: `s{씬번호}-{narration|narrationOut|question|speech|line0…}`
 */
export type AudioManifest = Record<string, AudioClip>;

export type VideoSpec = {
  slug: string;
  /** 렌더 스크립트가 brand.json 을 읽어 자동으로 채운다 */
  brand?: Brand;
  /** 렌더 스크립트가 <slug>.audio.json 을 읽어 자동으로 채운다. 없으면 무음 영상이 된다 */
  audio?: AudioManifest;
  title: string;
  subtitle?: string;
  /**
   * 지문 출처. 표지에 크게, 이후 모든 씬 상단에 작게 표시된다.
   * 예: "2025학년도 수능 34번", "천재교육 고2 영어 4과", "2024 고3 6월 모평 31번"
   */
  source?: string;
  /**
   * 씬 구성을 고르는 기준 (화면에 표시되지 않는다).
   * story = 필자의 경험/일화, academic = 개념 설명형
   */
  kind: "story" | "academic";
  characters: Record<string, CharacterPreset>;
  scenes: Scene[];
};
