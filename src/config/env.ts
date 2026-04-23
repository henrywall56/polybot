import { z } from "zod";

const envSchema = z.object({
  POLYMARKET_GAMMA_BASE_URL: z.string().url(),
});

const runtime = globalThis as typeof globalThis & {
  Bun?: { env: Record<string, string | undefined> };
};

const parsedEnv = envSchema.safeParse(runtime.Bun?.env ?? {});

if (!parsedEnv.success) {
  console.error("Invalid environment variables:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsedEnv.data;
