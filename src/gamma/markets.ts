import { z } from "zod";
import { env } from "../config/env.ts";

const gammaTagSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	label: z.string().nullable(),
});

const gammaMarketSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	question: z.string().nullable(),
	groupItemTitle: z.string().nullable(),
	groupItemThreshold: z.string().nullable(),
	endDate: z.string().nullable(),
	startDate: z.string().nullable(),
	updatedAt: z.string().nullable(),
	active: z.boolean().optional(),
	closed: z.boolean().optional(),
	acceptingOrders: z.boolean().optional(),
	outcomePrices: z.string().nullable().optional(),
	bestBid: z.number().nullable().optional(),
	bestAsk: z.number().nullable().optional(),
	lastTradePrice: z.number().nullable().optional(),
	volumeNum: z.number().nullable().optional(),
	liquidityNum: z.number().nullable().optional(),
});

const gammaEventSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	title: z.string().nullable(),
	updatedAt: z.string().nullable(),
	endDate: z.string().nullable(),
	eventDate: z.string().nullable().optional(),
	startTime: z.string().nullable().optional(),
	tags: z.array(gammaTagSchema).default([]),
	markets: z.array(gammaMarketSchema).default([]),
});

export type GammaMarket = z.infer<typeof gammaMarketSchema>;
export type GammaEvent = z.infer<typeof gammaEventSchema>;
export type TemperatureKind = "high" | "low";
export type TemperatureUnit = "C" | "F";

export interface TemperatureMarket {
	acceptingOrders: boolean | null;
	active: boolean | null;
	bestAsk: number | null;
	bestBid: number | null;
	city: string | null;
	closed: boolean | null;
	eventId: string;
	eventSlug: string | null;
	eventTitle: string | null;
	eventUpdatedAt: string | null;
	lastTradePrice: number | null;
	liquidity: number | null;
	marketDate: string | null;
	marketEndDate: string | null;
	marketId: string;
	marketSlug: string | null;
	marketTitle: string | null;
	marketUpdatedAt: string | null;
	temperatureBand: string | null;
	temperatureBandIndex: number | null;
	temperatureKind: TemperatureKind | null;
	unit: TemperatureUnit | null;
	volume: number | null;
}

const PAGE_SIZE = 100;
const TEMPERATURE_TITLE_PATTERN = /temperature in (.+?) on/i;

export async function fetchAllActiveEventsByTagId(
	tagId: string
): Promise<GammaEvent[]> {
	const events: GammaEvent[] = [];
	let offset = 0;

	while (true) {
		const url = new URL("/events", env.POLYMARKET_GAMMA_BASE_URL);

		url.searchParams.set("active", "true");
		url.searchParams.set("closed", "false");
		url.searchParams.set("tag_id", tagId);
		url.searchParams.set("limit", String(PAGE_SIZE));
		url.searchParams.set("offset", String(offset));

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`Gamma events fetch failed: ${response.status} ${response.statusText}`
			);
		}

		const json = await response.json();
		const page = z.array(gammaEventSchema).parse(json);

		events.push(...page);

		if (page.length < PAGE_SIZE) {
			return events;
		}

		offset += PAGE_SIZE;
	}
}

export async function fetchAllActiveMarketsByTagId(
	tagId: string
): Promise<GammaMarket[]> {
	const events = await fetchAllActiveEventsByTagId(tagId);

	return events.flatMap((event) => event.markets);
}

const GENERIC_TAG_SLUGS = new Set([
	"weather",
	"recurring",
	"hide-from-new",
	"daily-temperature",
	"highest-temperature",
	"lowest-temperature",
]);

function extractCity(event: GammaEvent): string | null {
	const cityTag = event.tags.find((tag) => {
		const slug = tag.slug?.toLowerCase();

		return slug != null && !GENERIC_TAG_SLUGS.has(slug);
	});

	if (cityTag?.label) {
		return cityTag.label;
	}

	const title = event.title ?? "";
	const match = title.match(TEMPERATURE_TITLE_PATTERN);

	return match?.[1] ?? null;
}

function extractTemperatureKind(event: GammaEvent): TemperatureKind | null {
	const tagSlugs = event.tags.map((tag) => tag.slug?.toLowerCase());

	if (tagSlugs.includes("highest-temperature")) {
		return "high";
	}

	if (tagSlugs.includes("lowest-temperature")) {
		return "low";
	}

	const title = event.title?.toLowerCase() ?? "";

	if (title.includes("highest temperature")) {
		return "high";
	}

	if (title.includes("lowest temperature")) {
		return "low";
	}

	return null;
}

function extractTemperatureBandIndex(
	groupItemThreshold: string | null
): number | null {
	if (groupItemThreshold == null) {
		return null;
	}

	const parsed = Number(groupItemThreshold);

	return Number.isFinite(parsed) ? parsed : null;
}

function extractUnit(groupItemTitle: string | null): TemperatureUnit | null {
	if (groupItemTitle == null) {
		return null;
	}

	if (groupItemTitle.includes("°C")) {
		return "C";
	}

	if (groupItemTitle.includes("°F")) {
		return "F";
	}

	return null;
}

export function mapTemperatureMarkets(
	events: GammaEvent[]
): TemperatureMarket[] {
	return events.flatMap((event) =>
		event.markets.map((market) => ({
			marketId: market.id,
			marketSlug: market.slug,
			marketTitle: market.question,
			eventId: event.id,
			eventSlug: event.slug,
			eventTitle: event.title,
			city: extractCity(event),
			temperatureKind: extractTemperatureKind(event),
			temperatureBand: market.groupItemTitle,
			temperatureBandIndex: extractTemperatureBandIndex(
				market.groupItemThreshold
			),
			unit: extractUnit(market.groupItemTitle),
			marketDate: event.eventDate ?? event.endDate,
			marketEndDate: market.endDate,
			eventUpdatedAt: event.updatedAt,
			marketUpdatedAt: market.updatedAt,
			active: market.active ?? null,
			closed: market.closed ?? null,
			acceptingOrders: market.acceptingOrders ?? null,
			bestBid: market.bestBid ?? null,
			bestAsk: market.bestAsk ?? null,
			lastTradePrice: market.lastTradePrice ?? null,
			volume: market.volumeNum ?? null,
			liquidity: market.liquidityNum ?? null,
		}))
	);
}
