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

const PAGE_SIZE = 100;

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
