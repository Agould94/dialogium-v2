"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { CuratedVideo } from "@/lib/schemas";

type QuizQuestion = {
  id: string;
  kind: "multiple_choice" | "free_response";
  prompt: string;
  options: string[] | null;
};

type Quiz = { questions: QuizQuestion[] };

type AttemptResult = { score: number; maxScore: number; feedback: string };

export default function LessonView(props: {
  lessonId: string;
  initialContent: string | null;
  initialVideos: CuratedVideo[];
  initialQuiz: Quiz | null;
}) {
  const [content, setContent] = useState(props.initialContent ?? "");
  const [videos, setVideos] = useState<CuratedVideo[]>(props.initialVideos);
  const [generating, setGenerating] = useState(false);
  const [curating, setCurating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (props.initialContent || startedRef.current) return;
    startedRef.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    setContent("");
    try {
      const res = await fetch(`/api/lessons/${props.lessonId}/generate`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Lesson generation failed.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawText = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "text") {
            sawText = true;
            setContent((c) => c + event.text);
          } else if (event.type === "videos") {
            setCurating(false);
            setVideos(event.videos);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
        if (sawText) setCurating(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lesson generation failed.");
    } finally {
      setGenerating(false);
      setCurating(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}{" "}
          <button onClick={generate} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!content && generating && (
        <p className="animate-pulse text-sm text-neutral-500">Writing your lesson…</p>
      )}

      <article className="prose prose-neutral max-w-none dark:prose-invert">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>

      {curating && (
        <p className="mt-6 animate-pulse text-sm text-neutral-500">Finding videos worth your time…</p>
      )}

      {videos.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Watch
          </h2>
          <ul className="space-y-3">
            {videos.map((v) => (
              <li key={v.url}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-4 rounded-lg border border-neutral-200 p-3 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  {v.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="h-20 w-36 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{v.title}</div>
                    {v.channel && <div className="mt-0.5 text-xs text-neutral-500">{v.channel}</div>}
                    {v.reason && (
                      <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        {v.reason}
                      </div>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {content && !generating && (
        <QuizSection lessonId={props.lessonId} initialQuiz={props.initialQuiz} />
      )}
    </div>
  );
}

function QuizSection(props: { lessonId: string; initialQuiz: Quiz | null }) {
  const [quiz, setQuiz] = useState<Quiz | null>(props.initialQuiz);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuiz() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lessons/${props.lessonId}/quiz`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quiz generation failed.");
      setQuiz({
        questions: data.questions.map(
          (q: { id: string; kind: string; prompt: string; options: string | null }) => ({
            id: q.id,
            kind: q.kind,
            prompt: q.prompt,
            options: q.options ? JSON.parse(q.options) : null,
          })
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Test yourself
      </h2>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!quiz ? (
        <button
          onClick={loadQuiz}
          disabled={loading}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? "Writing your quiz…" : "Quiz me on this lesson"}
        </button>
      ) : (
        <ol className="space-y-8">
          {quiz.questions.map((q, qi) => (
            <QuestionBlock key={q.id} question={q} number={qi + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function QuestionBlock({ question, number }: { question: QuizQuestion; number: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [freeAnswer, setFreeAnswer] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const answer = question.kind === "multiple_choice" ? String(selected) : freeAnswer;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Grading failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    question.kind === "multiple_choice" ? selected !== null : freeAnswer.trim().length > 0;

  return (
    <li>
      <p className="text-sm font-medium">
        <span className="mr-2 text-neutral-400">{number}.</span>
        {question.prompt}
      </p>

      {question.kind === "multiple_choice" && question.options ? (
        <div className="mt-3 space-y-2">
          {question.options.map((opt, oi) => (
            <label
              key={oi}
              className={`flex cursor-pointer items-baseline gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                selected === oi
                  ? "border-neutral-500 dark:border-neutral-300"
                  : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={selected === oi}
                onChange={() => setSelected(oi)}
                disabled={!!result}
                className="translate-y-0.5"
              />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          rows={4}
          value={freeAnswer}
          onChange={(e) => setFreeAnswer(e.target.value)}
          disabled={!!result}
          placeholder="Answer in your own words…"
          className="mt-3 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
        />
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!result ? (
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="mt-3 rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium transition-colors hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-neutral-400"
        >
          {submitting
            ? question.kind === "free_response"
              ? "Grading…"
              : "Checking…"
            : "Submit"}
        </button>
      ) : (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            result.score === result.maxScore
              ? "border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          <div className="font-medium">
            {result.score}/{result.maxScore}
          </div>
          <p className="mt-1 whitespace-pre-wrap">{result.feedback}</p>
        </div>
      )}
    </li>
  );
}
