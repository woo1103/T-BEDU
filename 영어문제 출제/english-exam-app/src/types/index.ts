export interface Choice {
  label: string; // "①" ~ "⑤"
  text: string;
  isCorrect: boolean;
}

export interface QuestionData {
  id?: string;
  examType: ExamType;
  questionType: string;
  number?: number;
  points: number;
  passage: string;
  question: string;
  choices: Choice[];
  answer: string;
  explanation?: string;
  difficulty: Difficulty;
  tags?: string[];
  source?: string;
  aiGenerated: boolean;
}

export interface ExamData {
  id?: string;
  title: string;
  examType: ExamType;
  description?: string;
  totalPoints: number;
  timeLimit?: number;
  headerInfo?: ExamHeaderInfo;
  instructions?: string;
}

export interface ExamHeaderInfo {
  school?: string;
  grade?: string;
  date?: string;
  teacher?: string;
  subject?: string;
}

export interface ExamItemData {
  id?: string;
  examId: string;
  questionId: string;
  orderNum: number;
  customPoints?: number;
}

export interface TemplateStructureItem {
  questionType: string;
  count: number;
  points: number;
}

export type ExamType = "suneung" | "naesin" | "toeic" | "toefl" | "custom";
export type Difficulty = "easy" | "medium" | "hard";

export interface GenerateRequest {
  examType: ExamType;
  questionType: string;
  difficulty: Difficulty;
  topic?: string;
  count?: number;
}
