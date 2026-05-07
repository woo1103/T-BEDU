"use client";

import { Fragment } from "react";
import type { Node } from "@/lib/textbook-parser";
import type { Choice } from "@/types";

export interface RenderQuestion {
  id: string;
  passage: string;
  question: string;
  choices: string;
  answer: string;
  points: number;
}

export interface TextbookRendererProps {
  nodes: Node[];
  questions: Record<string, RenderQuestion>;
  showAnswers?: boolean;
}

export default function TextbookRenderer({
  nodes,
  questions,
  showAnswers = false,
}: TextbookRendererProps) {
  return (
    <div className="textbook-body text-gray-900">
      {nodes.map((n, i) => (
        <RenderNode key={i} node={n} questions={questions} showAnswers={showAnswers} />
      ))}
    </div>
  );
}

const NAMED_COLORS: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  purple: "#9333ea",
  teal: "#0d9488",
  pink: "#db2777",
  gray: "#4b5563",
  black: "#111827",
};

function resolveColor(c: string): string {
  const v = c.trim().toLowerCase();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim())) return c.trim();
  return "inherit";
}

const CALLOUT_STYLES: Record<
  "tip" | "point" | "warn" | "info",
  { wrap: string; head: string }
> = {
  tip: {
    wrap: "border-blue-200 bg-blue-50 print:bg-white",
    head: "bg-blue-100 text-blue-800",
  },
  point: {
    wrap: "border-purple-200 bg-purple-50 print:bg-white",
    head: "bg-purple-100 text-purple-800",
  },
  warn: {
    wrap: "border-red-200 bg-red-50 print:bg-white",
    head: "bg-red-100 text-red-800",
  },
  info: {
    wrap: "border-emerald-200 bg-emerald-50 print:bg-white",
    head: "bg-emerald-100 text-emerald-800",
  },
};

function RenderNode({
  node,
  questions,
  showAnswers,
}: {
  node: Node;
  questions: Record<string, RenderQuestion>;
  showAnswers: boolean;
}) {
  switch (node.type) {
    case "text":
      return <Fragment>{node.value}</Fragment>;

    case "paragraph":
      return (
        <p className="my-2 leading-relaxed">
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </p>
      );

    case "section":
      return node.level === 1 ? (
        <h2 className="text-xl font-bold mt-6 mb-3 border-b border-gray-300 pb-1">
          {node.title}
        </h2>
      ) : (
        <h3 className="text-base font-semibold mt-4 mb-2">{node.title}</h3>
      );

    case "question": {
      const q = questions[node.id];
      if (!q) {
        return (
          <div className="my-4 p-3 border border-red-300 bg-red-50 text-sm text-red-700 rounded">
            문제를 찾을 수 없음: {node.id}
          </div>
        );
      }
      let choices: Choice[] = [];
      try {
        choices = JSON.parse(q.choices);
      } catch {}
      return (
        <div className="my-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded mt-0.5">
              {q.points}점
            </span>
            <p className="font-medium flex-1">{q.question}</p>
          </div>
          {q.passage && (
            <div className="border border-gray-300 rounded p-3 mb-2 bg-gray-50 print:bg-white">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {q.passage}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-0.5 ml-4">
            {choices.map((c, i) => (
              <p
                key={i}
                className={`text-sm ${
                  showAnswers && c.isCorrect ? "text-red-600 font-bold" : ""
                }`}
              >
                {c.label} {c.text}
                {showAnswers && c.isCorrect && " ◀ 정답"}
              </p>
            ))}
          </div>
        </div>
      );
    }

    case "passage":
      return (
        <div className="my-3 border border-gray-300 rounded p-3 bg-gray-50 print:bg-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {node.value}
          </p>
        </div>
      );

    case "vspace":
      return <div style={{ height: node.size }} />;

    case "pagebreak":
      return <div className="page-break" style={{ pageBreakAfter: "always" }} />;

    case "hrule":
      return <hr className="my-4 border-gray-300" />;

    case "linebreak":
      return <br />;

    case "hspace":
      return <span style={{ display: "inline-block", width: node.size }} />;

    case "bold":
      return (
        <strong>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </strong>
      );

    case "italic":
      return (
        <em>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </em>
      );

    case "underline":
      return (
        <span style={{ textDecoration: "underline" }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </span>
      );

    case "strike":
      return (
        <span style={{ textDecoration: "line-through" }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </span>
      );

    case "color":
      return (
        <span style={{ color: resolveColor(node.color) }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </span>
      );

    case "highlight":
      return (
        <mark className="bg-yellow-200 px-0.5 rounded-sm">
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </mark>
      );

    case "center":
      return (
        <div className="text-center">
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </div>
      );

    case "columns":
      return (
        <div
          className="my-3 gap-4"
          style={{ columnCount: node.count, columnGap: "1.5rem" }}
        >
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </div>
      );

    case "box":
      return (
        <div className="my-3 border-2 border-gray-400 rounded p-3">
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
          ))}
        </div>
      );

    case "callout": {
      const s = CALLOUT_STYLES[node.variant];
      return (
        <div className={`my-3 border rounded-lg overflow-hidden ${s.wrap}`}>
          <div className={`px-3 py-1.5 text-sm font-semibold ${s.head}`}>
            {node.label}
          </div>
          <div className="px-3 py-2">
            {node.children.map((c, i) => (
              <RenderNode key={i} node={c} questions={questions} showAnswers={showAnswers} />
            ))}
          </div>
        </div>
      );
    }

    case "list":
      return (
        <ul className="my-2 ml-5 list-disc space-y-1">
          {node.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item.map((c, j) => (
                <RenderNode key={j} node={c} questions={questions} showAnswers={showAnswers} />
              ))}
            </li>
          ))}
        </ul>
      );

    case "error":
      return (
        <div className="my-2 p-2 border border-red-300 bg-red-50 text-xs text-red-700 rounded">
          {node.message}
        </div>
      );
  }
}
