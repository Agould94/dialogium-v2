import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateStructured } from "@/lib/anthropic";
import { QuizSchema } from "@/lib/schemas";

export const maxDuration = 300;

const QUIZ_SYSTEM = `You write quizzes that test whether a learner met a lesson's objective.

Write 3-5 questions: mostly multiple choice (exactly 4 options each, one correct, plausible distractors), plus at least one free_response question that requires explaining or applying the idea. Give each free_response question a rubric listing what a complete answer must cover. Test understanding of the lesson content, not trivia about its wording.`;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  if (!lesson.content) {
    return NextResponse.json({ error: "Generate the lesson before quizzing on it." }, { status: 409 });
  }
  if (lesson.quiz) return NextResponse.json(lesson.quiz);

  try {
    const generated = await generateStructured({
      schema: QuizSchema,
      system: QUIZ_SYSTEM,
      prompt: `Lesson: ${lesson.title}\nObjective: ${lesson.objective}\n\nLesson content:\n${lesson.content}`,
    });

    const quiz = await db.quiz.create({
      data: {
        lessonId: lesson.id,
        questions: {
          create: generated.questions.map((q, qi) => ({
            order: qi,
            kind: q.kind,
            prompt: q.prompt,
            options: q.options ? JSON.stringify(q.options) : null,
            correctIndex: q.correctIndex,
            rubric: q.rubric,
          })),
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (e) {
    console.error("Quiz generation failed:", e);
    const message = e instanceof Error ? e.message : "Quiz generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
