import { z } from "zod";
import { env } from "../config/env.ts";

const stationInfoSchema = z.object({
	icaoId: z.string().nullable().optional(),
	id: z.string(),
	lat: z.number(),
	lon: z.number(),
	site: z.string().nullable().optional(),
	siteType: z.array(z.string()).default([]),
});

const metarSchema = z.object({
	icaoId: z.string(),
	rawOb: z.string().nullable().optional(),
	reportTime: z.string().nullable().optional(),
	temp: z.number().nullable().optional(),
});

const tafSchema = z.object({
	icaoId: z.string(),
	issueTime: z.string().nullable().optional(),
	rawTAF: z.string().nullable().optional(),
});

export type AviationStation = z.output<typeof stationInfoSchema>;
export type AviationMetar = z.output<typeof metarSchema>;
export type AviationTaf = z.output<typeof tafSchema>;

async function fetchJsonArray<T extends z.ZodTypeAny>(
	url: URL,
	schema: T
): Promise<z.output<T>[]> {
	const response = await fetch(url, {
		headers: { "User-Agent": env.APP_USER_AGENT },
	});

	if (response.status === 204) {
		return [];
	}

	if (!response.ok) {
		throw new Error(
			`Aviation Weather fetch failed: ${response.status} ${response.statusText}`
		);
	}

	const json = await response.json();

	return z.array(schema).parse(json);
}

export async function fetchStationsByBoundingBox({
	maxLatitude,
	maxLongitude,
	minLatitude,
	minLongitude,
}: {
	maxLatitude: number;
	maxLongitude: number;
	minLatitude: number;
	minLongitude: number;
}): Promise<AviationStation[]> {
	const url = new URL("/api/data/stationinfo", env.AVIATION_WEATHER_BASE_URL);
	url.searchParams.set(
		"bbox",
		`${minLatitude},${minLongitude},${maxLatitude},${maxLongitude}`
	);
	url.searchParams.set("format", "json");

	return await fetchJsonArray(url, stationInfoSchema);
}

export async function fetchMetarsByStationIds(
	stationIds: string[]
): Promise<AviationMetar[]> {
	if (stationIds.length === 0) {
		return [];
	}

	const url = new URL("/api/data/metar", env.AVIATION_WEATHER_BASE_URL);
	url.searchParams.set("ids", stationIds.join(","));
	url.searchParams.set("format", "json");

	return await fetchJsonArray(url, metarSchema);
}

export async function fetchTafsByStationIds(
	stationIds: string[]
): Promise<AviationTaf[]> {
	if (stationIds.length === 0) {
		return [];
	}

	const url = new URL("/api/data/taf", env.AVIATION_WEATHER_BASE_URL);
	url.searchParams.set("ids", stationIds.join(","));
	url.searchParams.set("format", "json");

	return await fetchJsonArray(url, tafSchema);
}
