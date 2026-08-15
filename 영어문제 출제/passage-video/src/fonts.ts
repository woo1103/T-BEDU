import { continueRender, delayRender, staticFile } from "remotion";

/**
 * 한글 폰트를 저장소 안에 넣어 두고 직접 불러온다.
 *
 * OS 기본 폰트(맑은 고딕 등)에 의존하면 다른 PC·맥·리눅스에서 렌더할 때
 * 자간과 두께가 달라지거나 글자가 깨진다. 영상은 어디서 렌더해도 똑같아야 하므로
 * 폰트를 함께 커밋해서 쓴다.
 */
const handle = delayRender("Pretendard 폰트 로딩");

const font = new FontFace(
  "Pretendard",
  `url(${staticFile("fonts/PretendardVariable.woff2")}) format("woff2-variations")`,
  { weight: "45 920" }
);

font
  .load()
  .then((loaded) => {
    // 이 프로젝트의 TS DOM 타입에는 FontFaceSet.add 가 없어서 캐스팅한다
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // 폰트를 못 불러와도 렌더는 진행한다 (시스템 폰트로 폴백)
    console.warn("Pretendard 로딩 실패 — 시스템 폰트로 렌더합니다.", err);
    continueRender(handle);
  });
