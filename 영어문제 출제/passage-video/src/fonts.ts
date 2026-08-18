import { continueRender, delayRender, staticFile } from "remotion";

/**
 * 한글 폰트를 저장소 안에 넣어 두고 직접 불러온다.
 *
 * OS 기본 폰트(맑은 고딕 등)에 의존하면 다른 PC·맥·리눅스에서 렌더할 때
 * 자간과 두께가 달라지거나 글자가 깨진다. 영상은 어디서 렌더해도 똑같아야 하므로
 * 폰트를 함께 커밋해서 쓴다.
 *
 * 로딩은 @font-face 를 주입한 뒤 document.fonts.load 로 기다린다.
 * FontFace 생성자 방식은 렌더 워커를 여러 개 띄울 때 완료 신호가 오지 않아
 * delayRender 타임아웃으로 렌더가 통째로 실패하는 일이 있었다.
 */
const FAMILY = "Pretendard";

const style = document.createElement("style");
style.textContent = `
@font-face {
  font-family: '${FAMILY}';
  src: url('${staticFile("fonts/PretendardVariable.woff2")}') format('woff2-variations');
  font-weight: 45 920;
  font-display: block;
}`;
document.head.appendChild(style);

const handle = delayRender("Pretendard 폰트 로딩");
let settled = false;
const finish = () => {
  if (settled) return;
  settled = true;
  continueRender(handle);
};

// 실제로 쓰는 굵기들을 미리 로드한다 (한글 글리프를 포함해 요청해야 한다)
Promise.all([
  document.fonts.load(`400 100px ${FAMILY}`, "가"),
  document.fonts.load(`700 100px ${FAMILY}`, "가"),
  document.fonts.load(`900 100px ${FAMILY}`, "가"),
])
  .then(finish)
  .catch((err) => {
    console.warn("Pretendard 로딩 실패 — 시스템 폰트로 렌더합니다.", err);
    finish();
  });

// 어떤 경우에도 폰트 때문에 렌더 전체가 죽지 않도록 하는 안전장치
setTimeout(finish, 20000);
