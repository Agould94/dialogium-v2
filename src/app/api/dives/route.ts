import { db } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/anthropic";
import { consumeDailyBudget, DailyLimitError } from "@/lib/limits";

export const maxDuration = 300;

const DIVE_SYSTEM = `You are Dialogium's deep-dive explainer. The learner highlighted something in a lesson they don't fully understand. Write a focused deep dive on exactly what they highlighted — not the broader lesson topic.

Write Markdown. Write all math as LaTeX ($inline$, $$block$$).

Shape it to what was highlighted:
- One sentence on what it is, then the intuition.
- If it's math (an equation, notation, operation): unpack each piece of the notation, walk one tiny worked example with real numbers, then add a "### Try it" section with 2-3 practice problems; put each answer directly after its problem as "**Answer:** ..." on its own line.
- If it's a concept: the mechanism, why it matters, and a brief history or origin when that genuinely illuminates.

If — and only if — a live interactive visual would genuinely help (geometric meaning, an equation with parameters worth dragging, an algorithm's steps), append ONE fenced code block tagged viz containing a COMPLETE self-contained HTML document: inline CSS/JS only, no external resources, canvas or SVG, sized to fit a 600x360 frame, with a slider or draggable control where interaction teaches. Light background, dark text.

Keep everything outside the viz block under ~500 words. No greetings or filler.`;

// Streams NDJSON lines: {type:"text"|"done"|"error", ...}. Cached dives replay instantly.
export async function POST(req: Request) {
  const { lessonId, selection, context } = await req.json();
  const sel = typeof selection === "string" ? selection.trim() : "";
  if (!lessonId || !sel || sel.length > 300) {
    return Response.json(
      { error: "Highlight between 1 and 300 characters to dive deeper." },
      { status: 400 }
    );
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { plan: true } } },
  });
  if (!lesson) return Response.json({ error: "Lesson not found." }, { status: 404 });

  const selectionKey = sel.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
  const encoder = new TextEncoder();
  const headers = { "Content-Type": "application/x-ndjson; charset=utf-8" };

  const cached = await db.deepDive.findUnique({
    where: { lessonId_selectionKey: { lessonId, selectionKey } },
  });
  if (cached) {
    const body =
      JSON.stringify({ type: "text", text: cached.content }) +
      "\n" +
      JSON.stringify({ type: "done", cached: true }) +
      "\n";
    return new Response(body, { headers });
  }

  try {
    await consumeDailyBudget("dive");
  } catch (e) {
    if (e instanceof DailyLimitError) {
      return Response.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const msgStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: DIVE_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Course goal: ${lesson.module.plan.goal}\nLesson: ${lesson.title} — ${lesson.objective}\n\nSurrounding lesson text:\n…${context ?? ""}…\n\nThe learner highlighted:\n"${sel}"\n\nWrite the deep dive.`,
            },
          ],
        });

        msgStream.on("text", (delta) => send({ type: "text", text: delta }));

        const final = await msgStream.finalMessage();
        if (final.stop_reason === "refusal") {
          throw new Error("The model declined this request.");
        }
        const content = final.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

        await db.deepDive.upsert({
          where: { lessonId_selectionKey: { lessonId, selectionKey } },
          create: { lessonId, selectionKey, selection: sel, content },
          update: { content },
        });

        send({ type: "done" });
      } catch (e) {
        console.error("Deep dive failed:", e);
        send({ type: "error", message: e instanceof Error ? e.message : "Deep dive failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
