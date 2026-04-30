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

    case "error":
      return (
        <div className="my-2 p-2 border border-red-300 bg-red-50 text-xs text-red-700 rounded">
          {node.message}
        </div>
      );
  }
}
