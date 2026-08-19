import { db } from "./db";

// Global daily caps on model-backed endpoints, so a public demo can't run up
// an unbounded API bill. Counts reset at midnight UTC.
const DAILY_LIMITS: Record<string, number> = {
  plan: Number(process.env.PLAN_DAILY_LIMIT ?? 25),
  lesson: Number(process.env.LESSON_DAILY_LIMIT ?? 150),
  quiz: Number(process.env.QUIZ_DAILY_LIMIT ?? 150),
  grade: Number(process.env.GRADE_DAILY_LIMIT ?? 300),
};

export class DailyLimitError extends Error {
  constructor(kind: string) {
    super(
      `The demo has hit its daily ${kind} limit — it resets at midnight UTC. Thanks for trying it!`
    );
    this.name = "DailyLimitError";
  }
}

// Throws DailyLimitError if the day's budget for this kind is spent; otherwise
// records the call. Recorded before the model call, so failures still count —
// slightly conservative, which is the right direction for a spend guard.
export async function consumeDailyBudget(kind: "plan" | "lesson" | "quiz" | "grade") {
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  const used = await db.usage.count({
    where: { kind, createdAt: { gte: startOfDayUtc } },
  });
  if (used >= DAILY_LIMITS[kind]) throw new DailyLimitError(kind);

  await db.usage.create({ data: { kind } });
}
