import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import GoalForm from "./GoalForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Visitors see the demo plan plus plans created in their own browser session.
  const sessionId = (await cookies()).get("dialogium_session")?.value;
  const plans = await db.plan.findMany({
    where: { OR: [{ isDemo: true }, ...(sessionId ? [{ sessionId }] : [])] },
    orderBy: [{ isDemo: "desc" as const }, { createdAt: "desc" as const }],
    include: { modules: { include: { lessons: { select: { id: true } } } } },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Dialogium</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Tell it what you want to be able to do. It plans backward from there.
        </p>
      </header>

      <GoalForm />

      {plans.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Your plans
          </h2>
          <ul className="space-y-3">
            {plans.map((plan) => {
              const lessonCount = plan.modules.reduce((n, m) => n + m.lessons.length, 0);
              return (
                <li key={plan.id}>
                  <Link
                    href={`/plans/${plan.id}`}
                    className="block rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                  >
                    <div className="font-medium">
                      {plan.title}
                      {plan.isDemo && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-normal text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          example
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {plan.goal}
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">
                      {plan.modules.length} modules · {lessonCount} lessons
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
