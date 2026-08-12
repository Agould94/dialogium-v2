import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateStructured } from "@/lib/anthropic";
import { GradeSchema } from "@/lib/schemas";

export const maxDuration = 300;

const GRADING_SYSTEM = `You grade a learner's free-response answer against a rubric.

Score 0-10 for how completely the answer covers the rubric. Judge substance, not style — an informal but correct answer scores high. In the feedback, name specifically what the answer got right and what it missed from the rubric, and end with one pointer for improvement. Be honest; do not inflate scores.`;

export async function POST(req: Request) {
  const { questionId, answer } = await req.json();
  if (!questionId || typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "questionId and a non-empty answer are required." }, { status: 400 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { quiz: { include: { lesson: true } } },
  });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  try {
    let score: number;
    let maxScore: number;
    let feedback: string;

    if (question.kind === "multiple_choice") {
      const chosen = Number(answer);
      const options: string[] = question.options ? JSON.parse(question.options) : [];
      const correct = question.correctIndex ?? 0;
      maxScore = 1;
      score = chosen === correct ? 1 : 0;
      feedback =
        score === 1
          ? "Correct."
          : `Not quite — the correct answer is: ${options[correct] ?? "(unknown)"}`;
    } else {
      const grade = await generateStructured({
        schema: GradeSchema,
        system: GRADING_SYSTEM,
        prompt: `Lesson objective: ${question.quiz.lesson.objective}\n\nQuestion: ${question.prompt}\n\nRubric:\n${question.rubric ?? "(none provided — grade against the question and lesson objective)"}\n\nLearner's answer:\n${answer}`,
        maxTokens: 2000,
      });
      maxScore = 10;
      score = Math.max(0, Math.min(10, Math.round(grade.score)));
      feedback = grade.feedback;
    }

    const attempt = await db.attempt.create({
      data: { questionId, answer, score, maxScore, feedback },
    });

    return NextResponse.json(attempt, { status: 201 });
  } catch (e) {
    console.error("Grading failed:", e);
    const message = e instanceof Error ? e.message : "Grading failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
