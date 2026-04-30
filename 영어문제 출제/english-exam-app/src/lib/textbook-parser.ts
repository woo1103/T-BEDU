// LaTeX 스타일 마크업 파서
// 지원 명령어:
//   \section{제목}            큰 제목
//   \subsection{제목}         중간 제목
//   \question{문제ID}         문제 은행에서 문제 삽입
//   \passage{영문}            지문 박스
//   \vspace{1em}              세로 여백
//   \pagebreak                인쇄 시 페이지 나눔
//   \hrule                    가로선
//   \textbf{x}  \textit{x}    굵게/기울임 (인라인)
//   \center{x}                가운데 정렬 블록
//   \begin{columns}{2} ... \end{columns}   다단 조판
//   \begin{box} ... \end{box}              테두리 박스

export type Node =
  | { type: "text"; value: string }
  | { type: "paragraph"; children: Node[] }
  | { type: "section"; level: 1 | 2; title: string }
  | { type: "question"; id: string }
  | { type: "passage"; value: string }
  | { type: "vspace"; size: string }
  | { type: "pagebreak" }
  | { type: "hrule" }
  | { type: "bold"; children: Node[] }
  | { type: "italic"; children: Node[] }
  | { type: "center"; children: Node[] }
  | { type: "columns"; count: number; children: Node[] }
  | { type: "box"; children: Node[] }
  | { type: "error"; message: string };

const BLOCK_COMMANDS = new Set([
  "section",
  "subsection",
  "question",
  "passage",
  "vspace",
  "pagebreak",
  "hrule",
]);

class Parser {
  private pos = 0;
  constructor(private src: string) {}

  parse(): Node[] {
    return this.parseBlocks(null);
  }

  private parseBlocks(stopEnv: string | null): Node[] {
    const out: Node[] = [];
    let buf = "";
    const flushPara = () => {
      const trimmed = buf.trim();
      if (trimmed.length > 0) {
        const inline = parseInline(trimmed);
        out.push({ type: "paragraph", children: inline });
      }
      buf = "";
    };

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];

      // \end{...} for current environment
      if (ch === "\\" && this.peek("\\end{")) {
        const endName = this.readEnvName("\\end{");
        if (stopEnv && endName === stopEnv) {
          flushPara();
          return out;
        }
        // mismatched end — emit as text
        buf += `\\end{${endName}}`;
        continue;
      }

      // \begin{...}
      if (ch === "\\" && this.peek("\\begin{")) {
        flushPara();
        const node = this.readEnvironment();
        if (node) out.push(node);
        continue;
      }

      // \command...
      if (ch === "\\") {
        const cmd = this.tryReadCommand();
        if (cmd) {
          if (BLOCK_COMMANDS.has(cmd.name)) {
            flushPara();
            const block = makeBlockCommand(cmd.name, cmd.args);
            if (block) out.push(block);
            continue;
          }
          // inline command — keep raw, parseInline will handle later
          buf += rawCommand(cmd.name, cmd.args);
          continue;
        }
      }

      // paragraph break (\n\n)
      if (ch === "\n" && this.src[this.pos + 1] === "\n") {
        flushPara();
        while (this.src[this.pos] === "\n") this.pos++;
        continue;
      }

      buf += ch;
      this.pos++;
    }

    flushPara();
    return out;
  }

  private peek(s: string): boolean {
    return this.src.substring(this.pos, this.pos + s.length) === s;
  }

  private readEnvName(prefix: string): string {
    this.pos += prefix.length;
    let name = "";
    while (this.pos < this.src.length && this.src[this.pos] !== "}") {
      name += this.src[this.pos++];
    }
    if (this.src[this.pos] === "}") this.pos++;
    return name;
  }

  private readEnvironment(): Node | null {
    const name = this.readEnvName("\\begin{");
    const args: string[] = [];
    while (this.src[this.pos] === "{") {
      args.push(this.readBracedArg());
    }
    const inner = this.parseBlocks(name);
    return makeEnvironment(name, args, inner);
  }

  private readBracedArg(): string {
    if (this.src[this.pos] !== "{") return "";
    this.pos++;
    let depth = 1;
    let out = "";
    while (this.pos < this.src.length && depth > 0) {
      const ch = this.src[this.pos];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
      out += ch;
      this.pos++;
    }
    if (this.src[this.pos] === "}") this.pos++;
    return out;
  }

  private tryReadCommand(): { name: string; args: string[] } | null {
    const save = this.pos;
    if (this.src[this.pos] !== "\\") return null;
    this.pos++;
    let name = "";
    while (this.pos < this.src.length && /[a-zA-Z]/.test(this.src[this.pos])) {
      name += this.src[this.pos++];
    }
    if (!name) {
      this.pos = save;
      return null;
    }
    const args: string[] = [];
    while (this.src[this.pos] === "{") {
      args.push(this.readBracedArg());
    }
    return { name, args };
  }
}

function rawCommand(name: string, args: string[]): string {
  return `\\${name}` + args.map((a) => `{${a}}`).join("");
}

function makeBlockCommand(name: string, args: string[]): Node | null {
  switch (name) {
    case "section":
      return { type: "section", level: 1, title: args[0] ?? "" };
    case "subsection":
      return { type: "section", level: 2, title: args[0] ?? "" };
    case "question":
      return { type: "question", id: (args[0] ?? "").trim() };
    case "passage":
      return { type: "passage", value: args[0] ?? "" };
    case "vspace":
      return { type: "vspace", size: args[0] ?? "1em" };
    case "pagebreak":
      return { type: "pagebreak" };
    case "hrule":
      return { type: "hrule" };
  }
  return null;
}

function makeEnvironment(name: string, args: string[], children: Node[]): Node {
  if (name === "columns") {
    const count = parseInt(args[0] ?? "2", 10);
    return { type: "columns", count: isNaN(count) ? 2 : count, children };
  }
  if (name === "box") {
    return { type: "box", children };
  }
  if (name === "center") {
    return { type: "center", children };
  }
  return { type: "error", message: `알 수 없는 환경: ${name}` };
}

// 인라인 파서 — 한 단락 내부의 \textbf, \textit 등 처리
function parseInline(src: string): Node[] {
  const out: Node[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf.length > 0) {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };
  while (i < src.length) {
    if (src[i] === "\\") {
      // read command
      let j = i + 1;
      let name = "";
      while (j < src.length && /[a-zA-Z]/.test(src[j])) {
        name += src[j++];
      }
      if (name) {
        const args: string[] = [];
        while (src[j] === "{") {
          let depth = 1;
          j++;
          let arg = "";
          while (j < src.length && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") {
              depth--;
              if (depth === 0) break;
            }
            arg += src[j++];
          }
          if (src[j] === "}") j++;
          args.push(arg);
        }
        const node = makeInlineCommand(name, args);
        if (node) {
          flush();
          out.push(node);
          i = j;
          continue;
        }
      }
    }
    buf += src[i++];
  }
  flush();
  return out;
}

function makeInlineCommand(name: string, args: string[]): Node | null {
  switch (name) {
    case "textbf":
      return { type: "bold", children: parseInline(args[0] ?? "") };
    case "textit":
      return { type: "italic", children: parseInline(args[0] ?? "") };
    case "center":
      return { type: "center", children: parseInline(args[0] ?? "") };
  }
  return null;
}

export function parseMarkup(src: string): Node[] {
  return new Parser(src).parse();
}

// 사용한 question id 모두 추출 (서버에서 미리 fetch용)
export function extractQuestionIds(src: string): string[] {
  const ids: string[] = [];
  const re = /\\question\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    ids.push(m[1].trim());
  }
  return ids;
}
