import { z } from "zod";
import { env } from "../config/env.ts";
import type { GeoPoint } from "./types.ts";

const openMeteoGeocodeResultSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	timezone: z.string().nullable().optional(),
});

const openMeteoGeocodeResponseSchema = z.object({
	results: z.array(openMeteoGeocodeResultSchema).optional(),
});

export async function geocodeCity(city: string): Promise<GeoPoint | null> {
	const url = new URL("/v1/search", env.OPEN_METEO_GEOCODING_BASE_URL);
	url.searchParams.set("name", city);
	url.searchParams.set("count", "1");
	url.searchParams.set("language", "en");
	url.searchParams.set("format", "json");

	const response = await fetch(url, {
		headers: { "User-Agent": env.APP_USER_AGENT },
	});

	if (!response.ok) {
		throw new Error(
			`Open-Meteo geocoding failed: ${response.status} ${response.statusText}`
		);
	}

	const json = await response.json();
	const parsed = openMeteoGeocodeResponseSchema.parse(json);
	const [firstResult] = parsed.results ?? [];

	if (!firstResult) {
		return null;
	}

	return {
		latitude: firstResult.latitude,
		longitude: firstResult.longitude,
		timezone: firstResult.timezone ?? null,
	};
}
