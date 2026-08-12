import { db } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/anthropic";
import { curateVideos } from "@/lib/youtube";

export const maxDuration = 300;

const LESSON_SYSTEM = `You are Dialogium, a learning coach writing one lesson inside a learner's study plan.

Write the lesson in Markdown. Teach toward the stated objective: explain the ideas, include at least one worked example or concrete scenario, and close with a short "try it yourself" prompt. Write for the learner's stated background — no filler like "welcome" or "congratulations".`;

// Streams NDJSON lines: {type:"text"|"videos"|"done"|"error", ...}
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: { module: { include: { plan: true } } },
  });
  if (!lesson) {
    return Response.json({ error: "Lesson not found." }, { status: 404 });
  }

  const plan = lesson.module.plan;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const msgStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: LESSON_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Study plan: ${plan.title}\nLearner's goal: ${plan.goal}\nLearner's background: ${plan.background || "(not provided)"}\n\nModule: ${lesson.module.title}\nLesson: ${lesson.title}\nObjective: ${lesson.objective}\n\nWrite this lesson.`,
            },
          ],
        });

        msgStream.on("text", (delta) => send({ type: "text", text: delta }));

        const final = await msgStream.finalMessage();
        if (final.stop_reason === "refusal") {
          throw new Error("The model declined to write this lesson.");
        }
        const content = final.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

        let videos: Awaited<ReturnType<typeof curateVideos>> = [];
        try {
          videos = await curateVideos({
            lessonTitle: lesson.title,
            lessonObjective: lesson.objective,
            planGoal: plan.goal,
          });
        } catch (e) {
          console.error("Video curation failed (continuing without videos):", e);
        }

        await db.lesson.update({
          where: { id },
          data: { content, videos: JSON.stringify(videos) },
        });

        send({ type: "videos", videos });
        send({ type: "done" });
      } catch (e) {
        console.error("Lesson generation failed:", e);
        send({ type: "error", message: e instanceof Error ? e.message : "Generation failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
