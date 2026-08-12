import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await db.plan.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!plan) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        ← All plans
      </Link>

      <header className="mt-4 mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">{plan.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Goal: {plan.goal}
          {plan.timeline && ` · ${plan.timeline}`}
        </p>
        <p className="mt-4 text-neutral-700 dark:text-neutral-300">{plan.summary}</p>
      </header>

      <ol className="space-y-8">
        {plan.modules.map((module, mi) => (
          <li key={module.id}>
            <h2 className="font-semibold">
              <span className="mr-2 text-neutral-400">{mi + 1}</span>
              {module.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{module.objective}</p>
            <ol className="mt-3 space-y-2 border-l border-neutral-200 pl-4 dark:border-neutral-800">
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="group block rounded-md px-3 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span className="text-sm font-medium group-hover:underline">{lesson.title}</span>
                    {lesson.content && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">
                        started
                      </span>
                    )}
                    <div className="text-xs text-neutral-500">{lesson.objective}</div>
                  </Link>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </main>
  );
}
