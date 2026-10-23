// 브라우저 전용: 업로드한 PDF/이미지를 쪽 단위 캔버스로 만들고, 쪽 안의 영역을 잘라 JPEG로.
// (서버로는 쪽 이미지를 한 장씩 보내 인식 → 큰 교재도 뒤쪽 문제가 잘리지 않음)

const PAGE_WIDTH = 1600; // 인식용 쪽 이미지 폭(px). 수식 판독에 충분하면서 요청 크기는 작게.

export interface PageCanvas {
  page: number; // 1부터
  canvas: HTMLCanvasElement;
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PAGE_WIDTH / bitmap.width) || 1;
  const c = canvasOf(bitmap.width * scale, bitmap.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

// PDF 쪽 수와, 쪽 번호 → 캔버스 렌더 함수를 돌려준다(쪽마다 필요할 때 렌더 → 메모리 절약)
export async function openPages(
  file: File
): Promise<{ count: number; render: (page: number) => Promise<HTMLCanvasElement> }> {
  if (file.type !== "application/pdf") {
    const canvas = await imageFileToCanvas(file);
    return { count: 1, render: async () => canvas };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return {
    count: doc.numPages,
    render: async (n: number) => {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
      const c = canvasOf(viewport.width, viewport.height);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      // intent "print": 화면용 렌더는 requestAnimationFrame으로 나눠 그려서, 탭이 가려지면(다른 탭으로 이동)
      // 브라우저가 rAF를 멈춰 업로드가 멈춘다. 인쇄용 렌더는 rAF 없이 끝까지 그린다.
      await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;
      page.cleanup();
      return c;
    },
  };
}

export interface EncodedImage {
  base64: string; // data: 접두어 없음
  mime: "image/jpeg";
  width: number;
  height: number;
}

function encode(c: HTMLCanvasElement, quality: number): EncodedImage {
  const url = c.toDataURL("image/jpeg", quality);
  return { base64: url.slice(url.indexOf(",") + 1), mime: "image/jpeg", width: c.width, height: c.height };
}

export function pageToJpeg(c: HTMLCanvasElement): EncodedImage {
  return encode(c, 0.85);
}

/**
 * 쪽 캔버스에서 box(0~1 비율 [x0,y0,x1,y1]) 영역을 여유(pad, 비율)를 두고 잘라 JPEG로.
 * 모델이 준 좌표가 조금 빗나가도 내용이 잘리지 않게 여유를 준다.
 */
export function cropToJpeg(
  c: HTMLCanvasElement,
  box: [number, number, number, number],
  pad = 0.015,
  maxWidth = 1200
): EncodedImage {
  const [x0, y0, x1, y1] = box;
  const left = Math.max(0, (x0 - pad) * c.width);
  const top = Math.max(0, (y0 - pad) * c.height);
  const right = Math.min(c.width, (x1 + pad) * c.width);
  const bottom = Math.min(c.height, (y1 + pad) * c.height);
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);
  const scale = Math.min(1, maxWidth / w);
  const out = canvasOf(w * scale, h * scale);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, left, top, w, h, 0, 0, out.width, out.height);
  return encode(out, 0.9);
}
