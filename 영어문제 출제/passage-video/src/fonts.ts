import { staticFile } from "remotion";

/**
 * 한글 폰트를 저장소에 넣어 두고 CSS 로만 불러온다.
 *
 * 왜 delayRender 로 기다리지 않는가:
 * 폰트 로딩 완료를 기다리게 하면(직접 구현하든 @remotion/fonts 를 쓰든)
 * 렌더 워커 페이지가 새로 뜰 때마다 간헐적으로 완료 신호가 오지 않았고,
 * 그때마다 "delayRender was not cleared" 로 **렌더 전체가 실패**했다.
 * 매번 다른 프레임(693, 2998 …)에서 죽어 재현도 일정하지 않았다.
 *
 * 폰트는 화질 문제일 뿐이고 렌더 실패는 치명적이므로, 기다리지 않기로 한다.
 * font-display: swap 이라 폰트가 아직 준비되지 않은 순간에도 글자는 항상 보이고
 * (시스템 폰트로 그려진다), 준비되면 즉시 Pretendard 로 바뀐다.
 * 로컬 파일이라 실제로는 거의 즉시 적용된다.
 */
export const FONT_FAMILY = "Pretendard";

const style = document.createElement("style");
style.textContent = `
@font-face {
  font-family: '${FONT_FAMILY}';
  src: url('${staticFile("fonts/PretendardVariable.woff2")}') format('woff2-variations');
  font-weight: 45 920;
  font-display: swap;
}`;
document.head.appendChild(style);
