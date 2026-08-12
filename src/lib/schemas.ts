import { z } from "zod";

export const PlanSchema = z.object({
  title: z.string().describe("A short, motivating name for the study plan"),
  summary: z
    .string()
    .describe(
      "2-4 sentences: what reaching the goal requires, what the learner already brings, and how this plan bridges the gap"
    ),
  modules: z.array(
    z.object({
      title: z.string(),
      objective: z.string().describe("What the learner can do after this module"),
      lessons: z.array(
        z.object({
          title: z.string(),
          objective: z
            .string()
            .describe("A concrete, testable objective for this lesson"),
        })
      ),
    })
  ),
});
export type GeneratedPlan = z.infer<typeof PlanSchema>;

export const VideoQueriesSchema = z.object({
  queries: z
    .array(z.string())
    .describe("2-3 YouTube search queries likely to surface videos teaching this lesson"),
});

export const VideoRankingSchema = z.object({
  selections: z.array(
    z.object({
      videoId: z.string(),
      reason: z.string().describe("One sentence: why this video fits the lesson objective"),
    })
  ),
});

export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      kind: z.enum(["multiple_choice", "free_response"]),
      prompt: z.string(),
      options: z
        .array(z.string())
        .nullable()
        .describe("Exactly 4 options for multiple_choice; null for free_response"),
      correctIndex: z
        .number()
        .nullable()
        .describe("0-based index of the correct option; null for free_response"),
      rubric: z
        .string()
        .nullable()
        .describe(
          "For free_response: what a complete answer must cover, as grading criteria; null for multiple_choice"
        ),
    })
  ),
});
export type GeneratedQuiz = z.infer<typeof QuizSchema>;

export const GradeSchema = z.object({
  score: z.number().describe("0-10, per the rubric"),
  feedback: z
    .string()
    .describe(
      "Specific feedback: what the answer got right, what it missed from the rubric, and one pointer for improvement"
    ),
});
export type Grade = z.infer<typeof GradeSchema>;

export type CuratedVideo = {
  videoId: string | null;
  title: string;
  channel: string | null;
  url: string;
  thumbnail: string | null;
  reason: string | null;
  isSearchLink: boolean;
};
