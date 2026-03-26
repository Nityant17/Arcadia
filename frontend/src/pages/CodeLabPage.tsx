import { Button } from "@/components/ui/button";
import { apiClient, getApiErrorMessage } from "@/services/api";
import { Code2, Loader2, Play, Terminal, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Language = "python" | "javascript" | "c" | "cpp" | "java";

const BOILERPLATE: Record<Language, string> = {
  python: `n = int(input() or "5")
for i in range(1, n + 1):
    print(f"Square of {i} = {i*i}")`,
  javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim() || "5";
const n = Number(input);
for (let i = 1; i <= n; i += 1) {
  console.log(\`Square of \${i} = \${i * i}\`);
}`,
  c: `#include <stdio.h>

int main() {
    int n = 5;
    if (scanf("%d", &n) != 1) n = 5;
    for (int i = 1; i <= n; i++) {
        printf("Square of %d = %d\\n", i, i * i);
    }
    return 0;
}`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    int n = 5;
    if (!(cin >> n)) n = 5;
    for (int i = 1; i <= n; ++i) {
        cout << "Square of " << i << " = " << i * i << "\\n";
    }
    return 0;
}`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.hasNextInt() ? sc.nextInt() : 5;
        for (int i = 1; i <= n; i++) {
            System.out.println("Square of " + i + " = " + (i * i));
        }
    }
}`,
};

const LANGUAGE_KEYWORDS: Record<Language, string[]> = {
  python: [
    "def",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "in",
    "import",
    "from",
    "class",
    "try",
    "except",
    "with",
    "as",
    "pass",
    "break",
    "continue",
    "True",
    "False",
    "None",
    "and",
    "or",
    "not",
    "print",
    "range",
  ],
  javascript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "class",
    "new",
    "import",
    "from",
    "export",
    "async",
    "await",
    "try",
    "catch",
    "finally",
    "true",
    "false",
    "null",
    "undefined",
  ],
  c: [
    "int",
    "char",
    "float",
    "double",
    "void",
    "long",
    "short",
    "unsigned",
    "signed",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "return",
    "struct",
    "typedef",
    "enum",
    "const",
    "static",
    "sizeof",
    "include",
  ],
  cpp: [
    "int",
    "char",
    "float",
    "double",
    "void",
    "long",
    "short",
    "unsigned",
    "signed",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "return",
    "class",
    "struct",
    "template",
    "typename",
    "public",
    "private",
    "protected",
    "using",
    "namespace",
    "include",
    "const",
    "static",
    "auto",
    "nullptr",
    "cout",
    "cin",
  ],
  java: [
    "public",
    "private",
    "protected",
    "class",
    "interface",
    "enum",
    "static",
    "final",
    "void",
    "int",
    "long",
    "double",
    "float",
    "boolean",
    "char",
    "new",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "return",
    "try",
    "catch",
    "finally",
    "import",
    "package",
    "extends",
    "implements",
    "this",
    "super",
    "null",
    "true",
    "false",
  ],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightCode(language: Language, rawCode: string) {
  let working = escapeHtml(rawCode || " ");
  const tokens: string[] = [];

  const stash = (pattern: RegExp, className: string) => {
    working = working.replace(pattern, (match) => {
      const marker = `@@ARC_TOKEN_${tokens.length}@@`;
      tokens.push(`<span class=\"${className}\">${match}</span>`);
      return marker;
    });
  };

  stash(/\/\*[\s\S]*?\*\//g, "text-slate-400");
  stash(/(^|\s)#.*$/gm, (language === "python" ? "text-slate-400" : "text-slate-200") as string);
  stash(/\/\/.*$/gm, "text-slate-400");

  stash(/&quot;(?:[^&]|&(?!quot;))*?&quot;/g, "text-emerald-300");
  stash(/&#39;(?:[^&]|&(?!#39;))*?&#39;/g, "text-emerald-300");
  stash(/`(?:[^`]|\\`)*`/g, "text-emerald-300");

  const keywords = LANGUAGE_KEYWORDS[language] || [];
  if (keywords.length) {
    const keywordPattern = new RegExp(`\\b(${keywords.map(escapeRegExp).join("|")})\\b`, "g");
    stash(keywordPattern, "text-sky-300");
  }

  stash(/\b\d+(?:\.\d+)?\b/g, "text-amber-300");
  stash(/\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/g, "text-violet-300");

  working = working.replace(/@@ARC_TOKEN_(\d+)@@/g, (_match, index) => tokens[Number(index)] || "");
  return working;
}

export default function CodeLabPage() {
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(BOILERPLATE.python);
  const [stdin, setStdin] = useState("5");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [uploadingCode, setUploadingCode] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const TAB_SIZE = 4;
  const codeHighlightRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const highlightedCode = useMemo(() => highlightCode(language, code), [language, code]);

  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setDurationMs(null);

    try {
      const response = await apiClient.runCode({ language, code, stdin });
      setStdout(response.data.stdout || "");
      setStderr(response.data.stderr || "");
      setExitCode(response.data.exit_code);
      setDurationMs(response.data.duration_ms);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to run code"));
    } finally {
      setRunning(false);
    }
  }

  function detectLanguageFromFile(fileName: string): Language | null {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (ext === "py") return "python";
    if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
    if (ext === "c") return "c";
    if (ext === "cpp" || ext === "cc" || ext === "cxx" || ext === "hpp") return "cpp";
    if (ext === "java") return "java";
    return null;
  }

  async function extractTextFromFile(file: File) {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      return file.text();
    }

    const { default: Tesseract } = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "eng", {
      logger: (message) => {
        if (message?.status === "recognizing text" && typeof message.progress === "number") {
          setOcrProgress(Math.round(message.progress * 100));
        }
      },
    });
    return result.data.text || "";
  }

  function cleanExtractedCode(rawText: string) {
    const lines = rawText
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ".repeat(TAB_SIZE))
      .split("\n");

    const keywordHints = [
      "def",
      "return",
      "class",
      "public",
      "private",
      "static",
      "void",
      "int",
      "float",
      "double",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "continue",
      "import",
      "from",
      "const",
      "let",
      "var",
      "function",
      "println",
      "#include",
    ];

    const cleaned = lines
      .map((line) => line.replace(/\s+$/, "")) // trim right
      .map((line) => line.replace(/^\s*\d+\s+/, "")) // strip line numbers
      .filter((line, index, arr) => {
        const trimmed = line.trim();
        if (!trimmed) return true;

        const lower = trimmed.toLowerCase();
        if (
          lower.startsWith("page ") ||
          lower.includes("scanned with") ||
          lower.includes("generated by") ||
          lower.includes("confidential") ||
          lower.includes("copyright") ||
          lower.includes("copy") ||
          /^\d+\.\s/.test(trimmed)
        ) {
          return false;
        }

        const symbolScore = (trimmed.match(/[{}()[\];=<>:+\-*/%]/g) || []).length;
        const keywordScore = keywordHints.some((kw) => lower.includes(kw)) ? 1 : 0;
        const indentScore = line.startsWith(" ") ? 1 : 0;
        const digitScore = /\d/.test(trimmed) ? 1 : 0;
        const codeScore = symbolScore + keywordScore + indentScore + digitScore;

        if (codeScore >= 2) return true;
        if (trimmed.length < 3) return false;

        // Keep if neighboring lines look like code (for python blocks)
        const prev = arr[index - 1]?.trim() ?? "";
        const next = arr[index + 1]?.trim() ?? "";
        const neighborScore = [prev, next].filter(Boolean).some((neighbor) => /[:(){};=]/.test(neighbor));
        if (neighborScore) return true;

        return false;
      });

    const compacted = cleaned.join("\n").replace(/\n{3,}/g, "\n\n");
    return compacted.trim() ? compacted.trimEnd() + "\n" : "";
  }

  async function handleCodeUpload(file: File) {
    if (!file) return;
    setUploadingCode(true);
    setOcrProgress(0);
    try {
      const extracted = await extractTextFromFile(file);
      const cleaned = cleanExtractedCode(extracted);
      if (!extracted.trim()) {
        toast.error("No text was detected in the uploaded file.");
        return;
      }
      const detected = detectLanguageFromFile(file.name);
      if (detected) {
        setLanguage(detected);
      }
      setCode(cleaned || extracted);
      setStdout("");
      setStderr("");
      setExitCode(null);
      setDurationMs(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to extract code"));
    } finally {
      setUploadingCode(false);
      setOcrProgress(0);
    }
  }

  function switchLanguage(next: Language) {
    setLanguage(next);
    setCode(BOILERPLATE[next]);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setDurationMs(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 h-[calc(100dvh-7rem)]"
      data-ocid="code.page"
    >
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">Code Lab</h1>
        <p className="text-muted-foreground text-sm mt-1">Run Python, JavaScript, C, C++, and Java with syntax-highlighted editing.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 h-[calc(100%-4rem)]">
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/40 backdrop-blur-xl p-4 space-y-3 shadow-[0_0_24px_rgba(34,211,238,0.12)] h-full flex flex-col min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Code2 className="h-4 w-4 text-cyan-300" />
              Language
            </div>
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(event) => switchLanguage(event.target.value as Language)}
                className="arc-select bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript (Node)</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
              <Button
                onClick={runCode}
                disabled={running}
                className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
              >
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Run
              </Button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".py,.js,.mjs,.cjs,.c,.cpp,.cc,.cxx,.java,.txt,.md,.json,.yaml,.yml,.tsx,.ts,.jsx,.html,.css,.scss,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleCodeUpload(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                disabled={uploadingCode || running}
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
              >
                {uploadingCode ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-1" />
                )}
                Upload Code
              </Button>
            </div>
          </div>

          {uploadingCode ? (
            <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
              <span>Extracting code{ocrProgress ? ` · OCR ${ocrProgress}%` : ""}</span>
              <span className="text-[10px] uppercase tracking-widest text-cyan-300/80">Image OCR</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Upload code files or handwritten code images to auto-fill the editor.
            </div>
          )}

          <div className="relative flex-1 min-h-0 rounded-xl border border-white/10 bg-[#0f172a] overflow-hidden">
            <div ref={codeHighlightRef} className="absolute inset-0 overflow-auto pointer-events-none">
            <pre className="m-0 min-h-full p-3 text-sm leading-6 font-mono text-slate-100 whitespace-pre" style={{ tabSize: TAB_SIZE }}>
              <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
            </pre>
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart ?? 0;
              const end = target.selectionEnd ?? 0;
              const value = code;

              if (event.shiftKey) {
                const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                const hasIndent = value.slice(lineStart, lineStart + TAB_SIZE) === " ".repeat(TAB_SIZE);
                if (!hasIndent) return;
                const nextValue = value.slice(0, lineStart) + value.slice(lineStart + TAB_SIZE);
                setCode(nextValue);
                requestAnimationFrame(() => {
                  const nextPos = Math.max(start - TAB_SIZE, lineStart);
                  target.selectionStart = nextPos;
                  target.selectionEnd = Math.max(end - TAB_SIZE, lineStart);
                });
                return;
              }

              const nextValue = value.slice(0, start) + " ".repeat(TAB_SIZE) + value.slice(end);
              setCode(nextValue);
              requestAnimationFrame(() => {
                const nextPos = start + TAB_SIZE;
                target.selectionStart = nextPos;
                target.selectionEnd = nextPos;
              });
            }}
            onScroll={(event) => {
              if (!codeHighlightRef.current) return;
              codeHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
              codeHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }}
            style={{ tabSize: TAB_SIZE }}
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-white selection:bg-cyan-400/30 p-3 text-sm font-mono leading-6 outline-none"
            spellCheck={false}
            placeholder="Write your code..."
          />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl p-4 space-y-3 h-full flex flex-col min-h-0">
          <div className="text-sm text-foreground font-medium">Program Input (stdin)</div>
          <textarea
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            className="w-full min-h-[8rem] rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-cyan-500/50"
            spellCheck={false}
            placeholder="Input lines here..."
          />

          <div className="flex items-center gap-2 text-sm text-foreground pt-1">
            <Terminal className="h-4 w-4 text-cyan-300" />
            Output
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs font-mono text-foreground min-h-[16rem] whitespace-pre-wrap break-words overflow-auto flex-1">
            {stdout || "(stdout is empty)"}
          </div>

          {stderr ? (
            <>
              <div className="text-xs text-red-300 font-medium">stderr</div>
              <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs font-mono text-red-200 whitespace-pre-wrap break-words overflow-auto max-h-48">
                {stderr}
              </div>
            </>
          ) : null}

          <div className="text-xs text-muted-foreground">
            Exit code: {exitCode === null ? "-" : exitCode} | Runtime: {durationMs === null ? "-" : `${durationMs} ms`}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
