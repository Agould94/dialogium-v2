import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic = globalForAnthropic.anthropic ?? new Anthropic();

if (process.env.NODE_ENV !== "production") globalForAnthropic.anthropic = anthropic;

// One helper for every structured call: schema-validated JSON out, or a thrown Error.
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to generate this content.");
  }
  if (response.parsed_output == null) {
    throw new Error("Model output did not match the expected structure.");
  }
  return response.parsed_output;
}
