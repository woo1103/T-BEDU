# T&BEDU 작업 저장소

woo1103(영어학원 T&BEDU 운영)의 작업 저장소. 세 갈래가 들어 있다.

| 폴더 | 내용 |
|---|---|
| `출석부/` | 학원 출석·비품 관리 앱 |
| `영어문제 출제/english-exam-app/` | Next.js + Claude API 기반 영어 문제 출제 앱 |
| `영어문제 출제/passage-video/` | **영어 지문 시각화 영상 렌더러** |

## 학원 정보

- 학원명은 **T&BEDU**다. "우리영어학원" 같은 임의의 이름을 쓰지 마라.
- 로고는 딥그린(`#245B3E` 계열) 원형에 흰 세리프 `T&B`. `passage-video/public/logo.png` 에 배경 투명 PNG로 들어 있다.

## 지문 영상 만들기 (가장 자주 하는 작업)

사용자가 영어 지문을 주면서 영상·시각화를 요청하면 **`passage-video` 스킬**을 쓴다
(`.claude/skills/passage-video/SKILL.md`). 코드를 새로 짜지 말고 씬 스크립트 JSON만 작성하면 된다.

지켜야 할 규칙 — 뒤집지 말 것:

1. **자막은 두 목소리를 오간다.**
   - 3인칭 나레이터: 어두운 밴드 + 흰 글씨 + 친근한 `~요` 체. 인물을 바깥에서 서술한다.
     ("미나는 어제 무엇을 먹었는지 떠올려 보려고 했어요.") `~했다` 같은 딱딱한 문어체 금지.
   - 인물이 말하는 순간: 그 인물의 옷 색 밴드 + 이름표 + 「 」 + 1인칭.
   - `narration` → 대사 → `narrationOut` 순서로 자동 전환된다.
2. **음성도 같은 2단 구조.** 나레이터는 `input/brand.json` 의 목소리로 **모든 영상에서 고정**(차분하고 따뜻한 여성 톤),
   인물은 캐릭터 프리셋의 `voice`. 목소리 이름은 추측하지 말고 `node scripts/voices.mjs` 로 확인한 것만 쓴다.
3. **캐릭터는 지문마다 새로 뽑는다.** 프리셋 조합만 바꾸면 되고, 새 컴포넌트를 만들지 않는다.
4. **영상 길이를 임의로 줄이지 마라.** 내용 이해가 최우선이라 느긋한 속도로 맞춰져 있고, 사용자가 이를 명시적으로 확인했다.
5. **지문 유형 배지("학술 지문")는 표시하지 않는다.** 대신 **지문 출처**를 표지와 모든 씬 상단에 넣는다.
6. 학술 지문은 지문을 통째로 옮기지 말고 "무슨 내용인지" 이해시키는 데 집중한다. 시험 포인트 강조는 넣지 않는다.

렌더 순서(자세한 내용은 스킬 문서):

```bash
cd "영어문제 출제/passage-video"
node scripts/doctor.mjs          # 환경 점검 — 새 PC에서 제일 먼저
node scripts/tts.mjs <slug>      # 음성 생성
node scripts/stills.mjs <slug>   # 씬별 화면을 PNG로 뽑아 눈으로 검토 (필수)
node scripts/render.mjs <slug>   # MP4
```

## 다른 PC에서 이어받을 때

`영어문제 출제/passage-video/README.md` 의 "새 PC에서 시작하기"를 따른다.
요약: `npm install` → `.env` 에 `GOOGLE_TTS_API_KEY` 채우기 → `node scripts/doctor.mjs`.

## 진행 상황

엔진·브랜드 인트로·TTS·배경음악까지 모두 동작한다. **영상 제작 진행 중.**

스토리 씬에서 지켜야 할 것 — 씬 스크립트를 쓸 때 매번 확인한다:

- `story` 씬은 인물을 **화면 가운데**에 세운다. 그래서 `room`·`classroom` 배경은 쓰지 마라.
  창틀·액자·칠판이 인물 머리 높이에 그대로 겹친다. `plain`·`night`·`street`·`library`·`lab`·`outdoor` 는 안전하다
  (건물·책장·언덕은 인물 뒤에 서 있어도 자연스럽다).
  인물이 양끝에 서는 `dialogue` 씬에는 해당되지 않는다.
- `story` 씬에 `speech` 가 있으면 **cast 는 말하는 사람 한 명만** 넣는다.
  말풍선이 화면 왼쪽(x 150~910)에 고정이라 둘을 세우면 앞사람 얼굴을 가린다.

확정된 것:
- 나레이터 `ko-KR-Chirp3-HD-Achernar` (사용자가 후보를 듣고 선택). `input/brand.json` 에 고정
- 배경음악 `public/bgm-calm-piano.mp3` (볼륨 0.07). `bgm-ambient.mp3` 로 교체 가능

**배역별 목소리 — 사용자가 샘플을 듣고 고른 확정본이다.** 임의로 바꾸지 마라.

| 배역 | 목소리 | 속도 |
|---|---|---|
| 여학생·젊은 여성 | `ko-KR-Chirp3-HD-Zephyr` | 1.0 |
| 남성·전문가 | `ko-KR-Chirp3-HD-Charon` | 0.95 |
| 남학생 | `ko-KR-Chirp3-HD-Fenrir` | 1.05 |
| 여자아이 | `ko-KR-Chirp3-HD-Erinome` | 1.08 |
| 삼촌·중년 남성 | `ko-KR-Chirp3-HD-Algenib` | 1.0 |
| 이모·중년 여성 | `ko-KR-Chirp3-HD-Kore` | 1.0 |
| 할아버지 | `ko-KR-Chirp3-HD-Enceladus` | 0.85 |
| 할머니 | `ko-KR-Chirp3-HD-Vindemiatrix` | 0.85 |

같은 영상에 젊은 여성이 둘 나와서 Zephyr 하나로는 모자랄 때만 `ko-KR-Chirp3-HD-Leda` 를 두 번째
젊은 여성 목소리로 쓴다. 그 외에는 표를 벗어나지 않는다.

표에 없는 배역이 필요하면 `node scripts/voice-sample.mjs male` / `female` 로 후보를 만들어
사용자에게 들려주고 고르게 한다. 추측해서 쓰지 마라.

Chirp3-HD 는 `speakingRate` 는 받지만 `pitch` 는 거부한다. 나이 표현은 속도로만 조절한다.
