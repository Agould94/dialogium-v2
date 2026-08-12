import { generateStructured } from "./anthropic";
import { VideoQueriesSchema, VideoRankingSchema, type CuratedVideo } from "./schemas";

type Candidate = {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string | null;
};

async function searchYouTube(query: string, key: string): Promise<Candidate[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", key);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("safeSearch", "strict");

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`YouTube search failed (${res.status}): ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).flatMap((item: any) => {
    const id = item.id?.videoId;
    if (!id) return [];
    return [
      {
        videoId: id,
        title: item.snippet?.title ?? "Untitled",
        channel: item.snippet?.channelTitle ?? "",
        description: item.snippet?.description ?? "",
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
      },
    ];
  });
}

// The 2023 version asked GPT-3 to invent YouTube links (they were hallucinated).
// Here the model only writes search queries and ranks real API results.
export async function curateVideos(context: {
  lessonTitle: string;
  lessonObjective: string;
  planGoal: string;
}): Promise<CuratedVideo[]> {
  const { queries } = await generateStructured({
    schema: VideoQueriesSchema,
    system:
      "You write YouTube search queries that surface instructional videos for a specific lesson in a study plan.",
    prompt: `Learner's goal: ${context.planGoal}\nLesson: ${context.lessonTitle}\nObjective: ${context.lessonObjective}\n\nWrite 2-3 search queries.`,
    maxTokens: 1000,
  });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    // Graceful degradation: link to YouTube search results instead of specific videos.
    return queries.map((q) => ({
      videoId: null,
      title: `Search YouTube: ${q}`,
      channel: null,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      thumbnail: null,
      reason: null,
      isSearchLink: true,
    }));
  }

  const resultsPerQuery = await Promise.all(queries.map((q) => searchYouTube(q, key)));
  const candidates = new Map<string, Candidate>();
  for (const c of resultsPerQuery.flat()) {
    if (!candidates.has(c.videoId)) candidates.set(c.videoId, c);
  }
  if (candidates.size === 0) return [];

  const candidateList = [...candidates.values()]
    .map(
      (c) =>
        `- id: ${c.videoId}\n  title: ${c.title}\n  channel: ${c.channel}\n  description: ${c.description.slice(0, 200)}`
    )
    .join("\n");

  const { selections } = await generateStructured({
    schema: VideoRankingSchema,
    system:
      "You curate videos for a lesson. Select only videos that plausibly teach the lesson objective, judged by title, channel, and description. Select up to 3; selecting fewer or none is better than padding with weak fits.",
    prompt: `Lesson: ${context.lessonTitle}\nObjective: ${context.lessonObjective}\n\nCandidates:\n${candidateList}`,
    maxTokens: 1000,
  });

  return selections.flatMap((s) => {
    const c = candidates.get(s.videoId);
    if (!c) return [];
    return [
      {
        videoId: c.videoId,
        title: c.title,
        channel: c.channel,
        url: `https://www.youtube.com/watch?v=${c.videoId}`,
        thumbnail: c.thumbnail,
        reason: s.reason,
        isSearchLink: false,
      },
    ];
  });
}
