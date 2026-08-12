import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateStructured } from "@/lib/anthropic";
import { PlanSchema } from "@/lib/schemas";

export const maxDuration = 300;

const PLAN_SYSTEM = `You are Dialogium, a goal-driven learning coach.

Given a learner's goal, background, and available time, design a study plan by working backward from the goal: determine what competence at the goal requires, subtract what the learner already knows, and sequence the remainder into modules of lessons.

Match the plan's size to the timeline — a weekend goal warrants a handful of lessons, a six-month goal a fuller arc. Do not pad. Every lesson objective must be concrete enough that a quiz could test it.`;

export async function POST(req: Request) {
  const { goal, background, timeline } = await req.json();
  if (!goal?.trim()) {
    return NextResponse.json({ error: "Tell us what you want to achieve." }, { status: 400 });
  }

  try {
    const generated = await generateStructured({
      schema: PlanSchema,
      system: PLAN_SYSTEM,
      prompt: `Goal: ${goal}\n\nBackground — what I already know: ${background || "(not provided)"}\n\nTime available: ${timeline || "(not provided)"}`,
    });

    const plan = await db.plan.create({
      data: {
        goal,
        background: background ?? "",
        timeline: timeline ?? "",
        title: generated.title,
        summary: generated.summary,
        modules: {
          create: generated.modules.map((m, mi) => ({
            order: mi,
            title: m.title,
            objective: m.objective,
            lessons: {
              create: m.lessons.map((l, li) => ({
                order: li,
                title: l.title,
                objective: l.objective,
              })),
            },
          })),
        },
      },
    });

    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch (e) {
    console.error("Plan generation failed:", e);
    const message = e instanceof Error ? e.message : "Plan generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
