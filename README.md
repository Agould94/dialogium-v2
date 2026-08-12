# Dialogium

A goal-driven learning coach. You tell it what you want to be able to do — "pass the AWS Solutions Architect exam", "read Japanese manga", "understand transformers well enough to fine-tune one" — along with what you already know and how much time you have. It plans backward from that goal into modules and lessons, writes each lesson when you open it, curates real YouTube videos for it, and quizzes you with graded free-response feedback.

This is the second life of a 2023 GPT-3 project of the same name. The original asked the model to emit a rigid plain-text syllabus and parsed it by hand (and hallucinated YouTube links). Everything hard about that version is now an API primitive: structured outputs replace the parser, and the model writes search queries against the real YouTube API instead of inventing URLs.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma 6 + SQLite (`prisma/dev.db`, zero-setup local dev)
- Anthropic TypeScript SDK, `claude-opus-5`, structured outputs via Zod
- YouTube Data API v3 (optional — degrades to search links without a key)

## Setup

```bash
npm install
cp .env.example .env   # then fill in your keys
npx prisma db push     # creates prisma/dev.db
npm run dev
```

`.env` keys:

- `ANTHROPIC_API_KEY` — required; from https://console.anthropic.com
- `YOUTUBE_API_KEY` — optional; from Google Cloud Console (YouTube Data API v3). Without it, lessons link to YouTube search results instead of curated videos.

## How it works

| Step | Route | Mechanism |
|---|---|---|
| Goal → plan | `POST /api/plans` | Structured output (Zod schema): backward-planned modules and lessons sized to the learner's timeline |
| Lesson content | `POST /api/lessons/:id/generate` | Streamed Markdown (NDJSON), persisted on completion |
| Video curation | same request, after content | Model writes search queries → YouTube API returns real candidates → model ranks by fit to the lesson objective |
| Quiz | `POST /api/lessons/:id/quiz` | Structured output: multiple choice + free response with grading rubrics |
| Grading | `POST /api/attempts` | Multiple choice graded deterministically; free responses graded by the model against the rubric with specific feedback |

## Roadmap

- Per-lesson Socratic tutor chat
- Adaptive pathing: quiz results reshape the remaining plan (remedial lessons, skips)
- Spaced repetition and "teach it back" review
- Skill-specific practice environments (code exercises with runnable checks first)
- Cross-plan concept knowledge graph
