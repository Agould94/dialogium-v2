import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CuratedVideo } from "@/lib/schemas";
import LessonView from "./LessonView";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      module: { include: { plan: true } },
      quiz: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!lesson) notFound();

  const videos: CuratedVideo[] = lesson.videos ? JSON.parse(lesson.videos) : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link
        href={`/plans/${lesson.module.planId}`}
        className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← {lesson.module.plan.title}
      </Link>

      <header className="mt-4 mb-8">
        <div className="text-sm text-neutral-500">{lesson.module.title}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{lesson.objective}</p>
      </header>

      <LessonView
        lessonId={lesson.id}
        initialContent={lesson.content}
        initialVideos={videos}
        initialQuiz={
          lesson.quiz
            ? {
                questions: lesson.quiz.questions.map((q) => ({
                  id: q.id,
                  kind: q.kind as "multiple_choice" | "free_response",
                  prompt: q.prompt,
                  options: q.options ? JSON.parse(q.options) : null,
                })),
              }
            : null
        }
      />
    </main>
  );
}
