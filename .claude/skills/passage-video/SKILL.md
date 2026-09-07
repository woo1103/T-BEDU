---
name: passage-video
description: 영어 지문을 만화 캐릭터 애니메이션 MP4로 시각화한다. 사용자가 영어 지문(또는 지문 파일)을 주면서 영상·시각화·지문영상을 요청할 때 사용한다. 스토리텔링 지문은 장면 재현으로, 학술 지문은 개념 시각화로 자동 전환한다.
---

# 지문 시각화 영상 만들기

영어 지문 하나를 받아 **T&BEDU 브랜드 인트로가 붙은 1920×1080 MP4**로 만든다.
렌더 엔진은 이미 완성되어 있다. **코드를 새로 쓰지 말고 씬 스크립트 JSON만 작성**하면 된다.

작업 폴더: `영어문제 출제/passage-video`

## 절대 규칙

1. **JSX·컴포넌트를 새로 만들지 않는다.** 캐릭터는 프리셋 조합, 화면은 11종 씬 타입으로만 표현한다.
   표현이 부족하면 씬을 더 쪼개거나 다른 씬 타입을 골라라.
2. **자막 말투** — 아래 "목소리 규칙"을 반드시 지킨다.
3. **지문 전체를 옮기지 않는다.** 학술 지문은 "이 지문이 무슨 이야기인지"를 이해시키는 것이 목표다.
   시험 포인트·정답 근거 강조는 넣지 않는다. 내용 이해가 최우선이다.
4. **캐릭터는 지문마다 새로 뽑는다.** 이전 영상의 프리셋을 재사용하지 말고, 지문 내용에 맞는 인물을 새로 조합한다.
5. 렌더 전에 **반드시 스틸을 뽑아 눈으로 확인**한다 (아래 5단계).

## 목소리 규칙 (가장 중요)

| 무엇 | 누가 | 말투 | 어디에 |
|---|---|---|---|
| `narration`, `narrationOut` | 3인칭 나레이터 | **친근한 `~요` 체** | 하단 어두운 밴드 |
| `lines[].text`, `question`, `speech.text` | 인물 본인 | **1인칭 대사** | 말풍선 + 인물 색 밴드 |
| `caption` | 3인칭 장면 설명 | 명사구 또는 `~요` | 상단 캡션 |
| `points`, `bullets`, `meaning` 등 카드 문구 | — | 짧은 명사구/평서문 (`~다` 허용) | 카드 안 |

- 나레이션은 인물을 **바깥에서** 서술한다: "미나는 어제 무엇을 먹었는지 떠올려 보려고 했어요."
  → `~했다` (X), `~했어요` (O). 딱딱한 논문체 금지.
- 인물 대사는 **1인칭 그대로**: "어제… 뭐 먹었지?"
- `narrationOut` 은 대사가 끝난 뒤 3인칭으로 돌아와 정리하는 한 줄이다. dialogue·hook·story 씬에 꼭 넣어라.
  이게 있으면 **3인칭 → 1인칭 → 3인칭** 흐름이 살아난다.
- `thought: true` 를 주면 소리 내지 않은 속마음이 된다 (생각풍선 + 점선 자막 + "(속마음)" 표시).

## 목소리 규칙

| 무엇 | 목소리 |
|---|---|
| 3인칭 나레이션 | **항상 동일** — `brand.json` 의 `narratorVoice` (차분하고 따뜻한 여성 톤). 절대 바꾸지 않는다 |
| 인물 대사 | 그 인물의 `voice`. 성별·연령·성격에 맞게 배정한다 |

캐릭터를 만들 때 `voice` 를 반드시 같이 배정한다.

**확정된 조합 — 기본으로 이걸 쓴다.**

| 배역 | 목소리 | 비고 |
|---|---|---|
| 여성·학생 | `ko-KR-Chirp3-HD-Zephyr` | 사용자가 듣고 확정 |
| 남성·전문가 | `ko-KR-Chirp3-HD-Charon` | 사용자가 듣고 확정 |

**아직 확정되지 않은 배역**(남학생·아이·노년·중년 등)이 필요하면 임의로 고르지 말고,
`node scripts/voice-sample.mjs male` / `female` 로 후보를 만들어 사용자에게 들려주고 고르게 한다.
확정 전까지는 위 두 목소리로 간다.

- **Chirp3-HD 는 `pitch` 를 지원하지 않는다.** 보내면 400 에러가 난다. 나이·성격은 `rate` 로만 조절한다
  (아이·밝은 인물 1.05, 기본 1.0, 노년 0.85).
- 같은 영상 안의 두 인물은 **목소리 이름이 서로 달라야** 한다.
- 목소리 이름을 **추측해서 쓰지 마라.** `node scripts/voices.mjs` 로 실제 목록을 확인하고 그중에서 고른다.

## 5단계 절차

### 1) 지문 유형 판별
- **story** — 필자/등장인물이 겪은 사건이 시간 순으로 흐른다. ("When I was…", "Last summer…", 일화·회상)
- **academic** — 개념·현상·연구를 설명한다. 대부분 여기 해당한다.
- 판별이 애매하면 `academic` 으로 간다.

### 2) 지문 해부 (JSON 쓰기 전에 머리로)
- 주제문 한 문장을 찾는다 → `quote` 씬에 쓴다.
- 대립 구조(통념 vs 실제, A vs B)가 있는지 → 있으면 `compare` 는 거의 필수다.
- 인과·과정 사슬이 있는지 → `flow`
- 핵심 용어가 있는지 → `concept`
- 추상적이라 감이 안 오면 일상 비유를 하나 만든다 → `analogy`
- 숫자 비교가 있으면 → `bars`

### 3) 캐릭터 뽑기 (2명 권장, 최대 3명)
지문 내용에 어울리는 역할을 정하고 프리셋을 조합한다. 이름은 짧게 (2~4자).
- 학술 지문: **궁금해하는 학생 1명 + 설명해 주는 전문가 1명** 조합이 가장 잘 먹는다.
- 스토리텔링: 지문의 실제 인물 (필자, 상대방).

```jsonc
"characters": {
  "mina": {
    "name": "미나",              // 화면 이름표 + 자막 이름표
    "voice": { "name": "ko-KR-Neural2-B", "rate": 1.05, "pitch": 2.5 },
    "skin": "#F6D2B8",
    "hair": "ponytail",          // short bob ponytail curly bun bald spiky long braids
    "hairColor": "#3B2A22",
    "outfit": "hoodie",          // tshirt labcoat suit apron hoodie robe dress uniform
    "outfitColor": "#6C7BE0",    // ★ 이 색이 그 인물의 1인칭 자막 밴드 색이 된다
    "accentColor": "#3A4470",    // 바지/치마 색
    "accessory": "none",         // none glasses roundGlasses cap hat crown headband earmuffs
    "facialHair": "none",        // none beard mustache
    "build": "slim",             // slim normal stout
    "prop": "none"               // none book flask coin phone leaf pen basket lamp
  }
}
```
- **두 인물의 `outfitColor` 는 확실히 다르게** 해라. 자막 색으로 화자를 구분한다.
- `outfitColor` 는 흰 글씨가 아니라 **검은 글씨가 얹히는 연한 밴드의 원색**이다. 너무 밝은 색(#EEE 계열)은 피한다.

### 4) 씬 스크립트 작성
`input/<slug>.json` 에 저장한다. `brand` 는 쓰지 않는다 (렌더 스크립트가 `input/brand.json` 에서 자동 주입).

```jsonc
{
  "slug": "memory-reconstruction",
  "title": "기억은 녹음기가 아니다",          // 표지 대제목 (12~18자)
  "subtitle": "심리학 · 기억의 재구성",
  "source": "2025학년도 수능 영어 34번",      // ★ 지문 출처. 표지에 크게, 모든 씬 상단에 작게
  "kind": "academic",
  "characters": { ... },
  "scenes": [ ... ]
}
```

**권장 씬 구성**

| 유형 | 순서 |
|---|---|
| academic | `title` → `hook` → `concept` → `dialogue` → `compare` → `flow` → `analogy` → `quote` → `recap` |
| story | `title` → `story` → `dialogue` → `story` → (`concept`) → `quote` → `recap` |

- 8~10씬이 적당하다. `title` 로 시작하고 `recap` 으로 끝내라.
- 같은 씬 타입을 연달아 두 번 쓰지 마라 (`story` 는 예외).
- `quote` 는 주제문 하나만. 영상에 영어 원문이 통째로 나오면 안 된다.

### 5) 음성 생성 → 렌더 & 자기 검토 (건너뛰지 말 것)

먼저 나레이션·대사를 음성으로 만든다. **씬 길이가 실제 음성 길이에 맞춰 다시 계산되므로 스틸보다 먼저 해야 한다.**

```bash
cd "영어문제 출제/passage-video" && node scripts/tts.mjs <slug>
```

- 텍스트가 안 바뀐 조각은 재사용하므로, JSON 문구를 고친 뒤 다시 돌려도 요금이 거의 들지 않는다.
- `GOOGLE_TTS_API_KEY` 가 없으면 설정 방법을 안내하며 멈춘다. 이때는 사용자에게 키를 요청하고,
  키 없이 진행해야 하면 음성 없이(무음) 렌더한다 — 엔진은 음성이 없어도 그대로 동작한다.

그다음 화면을 검토한다:

```bash
cd "영어문제 출제/passage-video" && node scripts/stills.mjs <slug>
```

`out/stills/` 의 PNG를 **Read 도구로 실제로 열어서 전부 확인**한다. 확인 항목:

- [ ] 글자가 카드/화면 밖으로 넘치지 않는가
- [ ] 캐릭터 손·소품이 머리나 옷에 묻혀 사라지지 않았는가
- [ ] 배경 장식이 캐릭터·말풍선과 겹치지 않는가
- [ ] 어두운 씬(`quote`)에서 자막과 진행 표시가 보이는가
- [ ] 화면이 텅 빈 씬은 없는가
- [ ] 1인칭 자막에 이름표와 「」가 제대로 붙었는가
- [ ] 나레이션이 전부 `~요` 체인가
- [ ] 인물마다 목소리가 다르게 배정됐는가 (`input/<slug>.audio.json` 의 `voice` 확인)

문제가 있으면 **JSON을 고쳐서** 해결한다 (문구 줄이기, 씬 쪼개기, 씬 타입 바꾸기, 캐릭터 수 줄이기).
JSON으로 못 고치는 레이아웃 결함이면 `src/scenes.tsx` 를 손보고, 왜 고쳤는지 주석을 남긴다.

확인이 끝나면 본 렌더:

```bash
cd "영어문제 출제/passage-video" && node scripts/render.mjs <slug>
```

결과는 `out/<slug>.mp4`. 완료 후 `SendUserFile` 로 사용자에게 보낸다.

러닝타임은 자동 계산된다 — 음성이 있으면 **실제 음성 길이 + 숨(0.42초)** 기준, 없으면 글자 수 기준(느린 4.8자/초).
**임의로 줄이지 마라.** 사용자가 명시적으로 "길이는 안 줄여도 된다"고 결정했다.

## 씬 타입 레퍼런스

공통 필드: `narration`, `narrationOut`, `english`(영어 원문 한 줄), `durationInFrames`(직접 지정할 때만).

```jsonc
// 표지
{ "type": "title", "title": "...", "subtitle": "...",
  "cast": [{ "who": "mina", "expression": "happy", "pose": "raise" }] }

// 인물이 1인칭 질문을 던져 흥미를 연다
{ "type": "hook", "question": "어제… 뭐 먹었지?", "thought": true,
  "cast": [{ "who": "mina", "expression": "thinking", "pose": "think" }] }

// 두 인물의 대화. 한 줄씩 순서대로 나오며 자막이 1인칭으로 전환된다
{ "type": "dialogue", "setting": "lab",
  "lines": [ { "who": "mina", "text": "..." }, { "who": "doctor", "text": "..." } ],
  "cast": [ { "who": "mina", "expression": "confused", "pose": "shrug" },
            { "who": "doctor", "expression": "neutral", "pose": "present", "flip": true } ] }

// 스토리텔링 한 컷 재현
{ "type": "story", "setting": "street", "caption": "낯선 도시, 갑자기 쏟아진 비",
  "sfx": "쏴아—",
  "speech": { "who": "writer", "text": "여기가 어디지…", "thought": true },
  "cast": [{ "who": "writer", "expression": "sad", "pose": "shrug" }] }

// 핵심 개념 한 장
{ "type": "concept", "term": "재구성적 기억", "meaning": "...(60자 이내)", "icon": "🧩",
  "cast": [{ "who": "doctor", "pose": "point" }] }

// 대조 — 학술 지문에서 가장 강력하다
{ "type": "compare", "heading": "우리의 착각 vs 실제",
  "left":  { "label": "녹음기 모델", "icon": "📼", "points": ["...", "...", "..."] },
  "right": { "label": "재구성 모델", "icon": "🧠", "points": ["...", "...", "..."] } }

// 인과·과정 (3~5단계)
{ "type": "flow", "heading": "기억을 꺼내는 네 단계",
  "steps": [ { "label": "경험", "icon": "👀" }, { "label": "빈칸 채우기", "icon": "✏️" } ] }

// 수치 비교
{ "type": "bars", "heading": "...", "unit": "%",
  "bars": [ { "label": "...", "value": 72, "note": "..." } ] }

// 일상 비유
{ "type": "analogy",
  "concept":  { "label": "기억을 떠올리는 일", "icon": "🧠" },
  "everyday": { "label": "레고를 다시 조립하는 일", "icon": "🧱" },
  "because": "왜 같은지 한 문장 (~요)" }

// 주제문 (어두운 화면)
{ "type": "quote", "sentence": "영어 원문 한 문장",
  "translation": "한국어 해석", "highlight": ["reconstruction", "not"] }

// 마무리 3줄
{ "type": "recap", "heading": "세 줄로 정리", "points": ["...", "...", "..."],
  "cast": [{ "who": "mina", "expression": "excited", "pose": "cheer" }] }
```

**표정** `neutral happy surprised thinking confused sad excited`
**포즈** `idle point raise shrug think present cheer`
**배경** `plain room classroom outdoor street night lab market library`

## 글자 수 상한 (넘치면 자동으로 작아지지만 가독성이 떨어진다)

| 자리 | 권장 |
|---|---|
| `title` | 18자 |
| `narration` / `narrationOut` | 45자 |
| 대사 한 줄 | 45자 |
| `compare` 의 `points` 한 줄 | 22자 |
| `flow` 의 `label` | 8자 |
| `recap` 의 `points` 한 줄 | 30자 |
| `concept.meaning` | 60자 |

## 브랜딩 · 사운드

`input/brand.json` 이 학원 정보(로고·나레이터 목소리·배경음악)를 갖고 있고, 렌더 시 3초 인트로가 자동으로 붙는다.
**지문 JSON에서는 절대 건드리지 않는다.** 파일이 없는 항목(로고·배경음악)은 자동으로 생략되므로 렌더는 항상 성공한다.

배경음악은 `public/bgm.mp3` 를 전 구간에 볼륨 0.07로 깔고 앞뒤 1.5초를 페이드한다.

## 참고 파일
- 완성 예시(학술): `input/sample-academic.json`
- 완성 예시(스토리): `input/sample-story.json`
- 씬 구현: `src/scenes.tsx` / 캐릭터: `src/Character.tsx` / 길이 계산: `src/duration.ts`
