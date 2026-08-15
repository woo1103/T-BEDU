# 지문 시각화 영상 (passage-video)

영어 지문 하나를 **T&BEDU 인트로가 붙은 1920×1080 MP4**로 만드는 렌더러.
Remotion(React로 영상을 그리는 도구)을 쓰므로 지문마다 코드를 짤 필요 없이 **JSON 한 개만 쓰면 된다.**

## 새 PC에서 시작하기

```bash
git clone https://github.com/woo1103/T-BEDU.git
cd "T-BEDU/영어문제 출제/passage-video"
npm install
cp .env.example .env      # 그리고 GOOGLE_TTS_API_KEY 를 채운다
node scripts/doctor.mjs   # 준비됐는지 점검
```

`doctor` 가 [정상] 만 띄우면 바로 렌더할 수 있다. 필요한 것:

- **Node 22 이상** — 스크립트가 `.ts` 파일을 직접 불러오므로 타입 스트리핑이 필요하다
- **TTS API 키** — 없어도 무음으로는 렌더된다
- 그 외(브라우저·인코더·한글 폰트)는 전부 자동이다. Remotion 이 첫 렌더 때 Chrome 을 받아오고,
  ffmpeg 는 번들되어 있으며, 한글 폰트는 `public/fonts/` 에 함께 커밋되어 있다

## 쓰는 법

Claude Code 에서 지문을 붙여넣고 영상을 요청하면 `passage-video` 스킬이 알아서 아래 과정을 수행한다.
직접 돌릴 때는:

```bash
# 1. 나레이션·대사 음성 생성 (씬 길이가 음성 길이에 맞춰 정해지므로 가장 먼저)
node scripts/tts.mjs sample-academic

# 2. 씬별 대표 화면을 PNG로 뽑아 눈으로 확인
node scripts/stills.mjs sample-academic

# 3. 확인 끝나면 MP4 렌더
node scripts/render.mjs sample-academic
```

사용 가능한 한국어 목소리 목록: `node scripts/voices.mjs`

- 입력: `input/<slug>.json`
- 출력: `out/<slug>.mp4`, `out/stills/<slug>-NN.png`
- 브라우저에서 미리보며 편집: `npx remotion studio`

## 구조

| 파일 | 역할 |
|---|---|
| `input/brand.json` | 학원명·로고·나레이터 목소리·배경음악. **모든 영상에 공통** (렌더 시 자동 주입) |
| `input/<slug>.json` | 지문 하나의 씬 스크립트 |
| `input/<slug>.audio.json` | 생성된 음성의 길이 정보 (`tts.mjs` 가 만든다) |
| `public/logo.png` | 인트로 로고 (배경 투명 PNG) |
| `public/bgm.mp3` | 배경음악 (없으면 배경음악 없이 렌더) |
| `public/audio/<slug>/` | 생성된 나레이션·대사 mp3 |
| `scripts/tts.mjs` | Google Cloud TTS로 음성 생성 (텍스트 안 바뀌면 재사용) |
| `src/types.ts` | 입력 JSON의 전체 스키마 |
| `src/Character.tsx` | 조합형 만화 캐릭터 (머리·옷·소품·표정·포즈) |
| `src/scenes.tsx` | 11종 씬 렌더러 |
| `src/ui.tsx` | 말풍선·자막 밴드·배경·카드 |
| `src/duration.ts` | 나레이션 글자 수 → 씬 길이 계산 (Node 스크립트와 공유) |
| `src/Intro.tsx` | 브랜드 인트로 3초 |

## 설계 규칙

**자막은 두 가지 목소리를 번갈아 쓴다.**
- 3인칭 나레이터 — 어두운 밴드 + 흰 글씨 + 친근한 `~요` 체
- 인물의 1인칭 대사 — 그 인물의 옷 색 밴드 + 이름표 + 「 」

`narration` → 대사 → `narrationOut` 순서로 자동 전환되므로, JSON에 세 필드를 채우면 흐름이 만들어진다.

**캐릭터는 지문마다 새로 뽑는다.** 프리셋 조합(머리 9종 × 옷 8종 × 액세서리 8종 × 소품 9종 …)만 바꾸면
그림 스타일은 유지되면서 전혀 다른 인물이 나온다.

**영상 길이는 자동 계산된다.** 음성이 있으면 실제 음성 길이 + 0.42초 숨을 기준으로,
없으면 자막을 편히 읽는 느린 속도(약 4.8자/초)를 기준으로 한다.
내용 이해가 최우선이므로 임의로 줄이지 않는다.

**목소리는 두 층으로 나뉜다.** 3인칭 나레이터는 `brand.json` 에서 한 번만 정해 모든 영상에서 동일하게 유지하고,
인물 대사는 각 캐릭터 프리셋의 `voice` 를 쓴다. 자막 밴드 색과 목소리가 함께 바뀌므로 화자가 두 겹으로 구분된다.

## 로고 교체

배경이 투명한 PNG를 `public/` 에 넣고 `input/brand.json` 의 `logo` 를 그 파일명으로 바꾼다.
`logo` 를 지우면 학원명으로 만든 원형 로고가 대신 나온다.
