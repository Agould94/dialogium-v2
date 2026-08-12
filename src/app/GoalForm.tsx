"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoalForm() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [background, setBackground] = useState("");
  const [timeline, setTimeline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, background, timeline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/plans/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="goal" className="mb-1.5 block text-sm font-medium">
          What do you want to achieve?
        </label>
        <textarea
          id="goal"
          required
          rows={2}
          placeholder="e.g. Pass the AWS Solutions Architect Associate exam"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className={inputClasses}
        />
      </div>
      <div>
        <label htmlFor="background" className="mb-1.5 block text-sm font-medium">
          What do you already know?
        </label>
        <textarea
          id="background"
          rows={2}
          placeholder="e.g. I'm a backend developer, comfortable with Docker, never used AWS"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          className={inputClasses}
        />
      </div>
      <div>
        <label htmlFor="timeline" className="mb-1.5 block text-sm font-medium">
          How much time do you have?
        </label>
        <input
          id="timeline"
          type="text"
          placeholder="e.g. 6 weeks, ~5 hours a week"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          className={inputClasses}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Designing your plan… (30–60s)" : "Build my plan"}
      </button>
    </form>
  );
}
