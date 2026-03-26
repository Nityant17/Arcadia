export type CodeLanguage = "python" | "javascript" | "c" | "cpp" | "java";

export interface CodeIntentInput {
  text?: string;
  filename?: string;
  topic?: string;
  subject?: string;
}

export interface CodeLabPrefill {
  language: CodeLanguage;
  code: string;
  stdin?: string;
  prompt?: string;
}

const CODE_PATTERNS = [
  /```[\s\S]*?```/g,
  /\b(def\s+\w+\(|class\s+\w+\s*[:{]|public\s+class\s+\w+|#include\s*<|console\.log\s*\(|System\.out\.println\s*\(|scanf\s*\(|cin\s*>>|cout\s*<<)\b/i,
  /\b(algorithm|leetcode|codeforces|function|runtime|time complexity|compile|debug|programming)\b/i,
];

export function detectCodingIntent(input: CodeIntentInput): boolean {
  const combined = `${input.filename || ""}\n${input.topic || ""}\n${input.subject || ""}\n${input.text || ""}`.trim();
  if (!combined) return false;
  return CODE_PATTERNS.some((pattern) => pattern.test(combined));
}

export function inferLanguage(input: CodeIntentInput): CodeLanguage {
  const filename = (input.filename || "").toLowerCase();
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".js") || filename.endsWith(".mjs") || filename.endsWith(".ts")) return "javascript";
  if (filename.endsWith(".c")) return "c";
  if (filename.endsWith(".cpp") || filename.endsWith(".cc") || filename.endsWith(".cxx")) return "cpp";
  if (filename.endsWith(".java")) return "java";

  const text = `${input.topic || ""}\n${input.subject || ""}\n${input.text || ""}`.toLowerCase();
  if (/(public\s+class|system\.out\.println|scanner\s*\()/i.test(text)) return "java";
  if (/(#include\s*<iostream>|std::|cout\s*<<)/i.test(text)) return "cpp";
  if (/(#include\s*<stdio|scanf\s*\(|printf\s*\()/i.test(text)) return "c";
  if (/(console\.log|const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+\()/i.test(text)) return "javascript";
  return "python";
}

export function extractCodeSnippet(text = ""): string {
  const fenced = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const lines = text.split(/\r?\n/);
  const codeLike = lines.filter((line) => /[{}();=<>]|\b(def|class|for|while|if|else|return|import|include)\b/.test(line));
  if (codeLike.length >= 2) {
    return codeLike.slice(0, 24).join("\n").trim();
  }

  const trimmed = text.trim();
  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}\n` : trimmed;
}

export function buildCodeLabPrefill(input: CodeIntentInput): CodeLabPrefill {
  const code = extractCodeSnippet(input.text || "") || "# Paste or write your code here";
  const language = inferLanguage(input);
  return {
    language,
    code,
    prompt: (input.text || "").slice(0, 2000),
  };
}
