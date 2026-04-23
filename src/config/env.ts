import { z } from "zod";

const envSchema = z.object({
	POLYMARKET_GAMMA_BASE_URL: z.string().url(),
	POLYMARKET_CLOB_BASE_URL: z
		.string()
		.url()
		.default("https://clob.polymarket.com"),
	AVIATION_WEATHER_BASE_URL: z
		.string()
		.url()
		.default("https://aviationweather.gov/api/data"),
	OPEN_METEO_GEOCODING_BASE_URL: z
		.string()
		.url()
		.default("https://geocoding-api.open-meteo.com/v1"),
	APP_USER_AGENT: z.string().min(1).default("polybot/0.1"),
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
