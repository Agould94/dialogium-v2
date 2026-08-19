// Seeds (or re-seeds) the demo plan from prisma/demo-plan.json.
// Idempotent: replaces any existing demo plan so the demo always matches the file.
// Run with: npm run seed:demo  (DATABASE_URL decides which database it hits.)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const db = new PrismaClient();
const data = JSON.parse(readFileSync(new URL("../prisma/demo-plan.json", import.meta.url), "utf8"));

const existing = await db.plan.findMany({ where: { isDemo: true }, select: { id: true } });
if (existing.length) {
  await db.plan.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${existing.length} old demo plan(s).`);
}

const plan = await db.plan.create({
  data: {
    isDemo: true,
    goal: data.goal,
    background: data.background,
    timeline: data.timeline,
    title: data.title,
    summary: data.summary,
    modules: {
      create: data.modules.map((m, mi) => ({
        order: mi,
        title: m.title,
        objective: m.objective,
        lessons: {
          create: m.lessons.map((l, li) => ({
            order: li,
            title: l.title,
            objective: l.objective,
            content: l.content,
            videos: l.videos,
            ...(l.quiz
              ? {
                  quiz: {
                    create: {
                      questions: {
                        create: l.quiz.questions.map((q, qi) => ({
                          order: qi,
                          kind: q.kind,
                          prompt: q.prompt,
                          options: q.options,
                          correctIndex: q.correctIndex,
                          rubric: q.rubric,
                        })),
                      },
                    },
                  },
                }
              : {}),
          })),
        },
      })),
    },
  },
});

console.log(`Seeded demo plan ${plan.id}: ${plan.title}`);
await db.$disconnect();
