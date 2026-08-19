import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public demo entry point: lands visitors on the seeded example plan.
export async function GET() {
  const demo = await db.plan.findFirst({ where: { isDemo: true }, select: { id: true } });
  if (!demo) {
    return Response.json(
      { error: "Demo not seeded. Run: npm run seed:demo" },
      { status: 503 }
    );
  }
  redirect(`/plans/${demo.id}`);
}
